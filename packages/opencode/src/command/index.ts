import { BusEvent } from "@/bus/bus-event"
import { InstanceContext } from "@/effect/instance-context"
import { runPromiseInstance } from "@/effect/runtime"
import { SessionID, MessageID } from "@/session/schema"
import { Effect, Fiber, Layer, ServiceMap } from "effect"
import z from "zod"
import { Config } from "../config/config"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"
import { MCP } from "../mcp"
import { Skill } from "../skill"
import { Log } from "../util/log"

export namespace Command {
  const log = Log.create({ service: "command" })
  export const Event = {
    Executed: BusEvent.define(
      "command.executed",
      z.object({
        name: z.string(),
        sessionID: SessionID.zod,
        arguments: z.string(),
        messageID: MessageID.zod,
      }),
    ),
  }

  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      agent: z.string().optional(),
      model: z.string().optional(),
      source: z.enum(["command", "mcp", "skill"]).optional(),
      // workaround for zod not supporting async functions natively so we use getters
      // https://zod.dev/v4/changelog?id=zfunction
      template: z.promise(z.string()).or(z.string()),
      subtask: z.boolean().optional(),
      hints: z.array(z.string()),
    })
    .meta({
      ref: "Command",
    })

  // for some reason zod is inferring `string` for z.promise(z.string()).or(z.string()) so we have to manually override it
  export type Info = Omit<z.infer<typeof Info>, "template"> & { template: Promise<string> | string }

  export function hints(template: string): string[] {
    const result: string[] = []
    const numbered = template.match(/\$\d+/g)
    if (numbered) {
      for (const match of [...new Set(numbered)].sort()) result.push(match)
    }
    if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
    return result
  }

  export const Default = {
    INIT: "init",
    REVIEW: "review",
  } as const

  export interface Interface {
    readonly get: (name: string) => Effect.Effect<Info | undefined>
    readonly list: () => Effect.Effect<Info[]>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Command") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const instance = yield* InstanceContext

      const commands: Record<string, Info> = {}

      const load = Effect.fn("Command.load")(function* () {
        yield* Effect.promise(async () => {
          const cfg = await Config.get()

          commands[Default.INIT] = {
            name: Default.INIT,
            description: "create/update AGENTS.md",
            source: "command",
            get template() {
              return PROMPT_INITIALIZE.replace("${path}", instance.worktree)
            },
            hints: hints(PROMPT_INITIALIZE),
          }
          commands[Default.REVIEW] = {
            name: Default.REVIEW,
            description: "review changes [commit|branch|pr], defaults to uncommitted",
            source: "command",
            get template() {
              return PROMPT_REVIEW.replace("${path}", instance.worktree)
            },
            subtask: true,
            hints: hints(PROMPT_REVIEW),
          }

          for (const [name, command] of Object.entries(cfg.command ?? {})) {
            commands[name] = {
              name,
              agent: command.agent,
              model: command.model,
              description: command.description,
              source: "command",
              get template() {
                return command.template
              },
              subtask: command.subtask,
              hints: hints(command.template),
            }
          }
          for (const [name, prompt] of Object.entries(await MCP.prompts())) {
            commands[name] = {
              name,
              source: "mcp",
              description: prompt.description,
              get template() {
                // since a getter can't be async we need to manually return a promise here
                return new Promise<string>(async (resolve, reject) => {
                  const template = await MCP.getPrompt(
                    prompt.client,
                    prompt.name,
                    prompt.arguments
                      ? // substitute each argument with $1, $2, etc.
                        Object.fromEntries(prompt.arguments?.map((argument, i) => [argument.name, `$${i + 1}`]))
                      : {},
                  ).catch(reject)
                  resolve(
                    template?.messages
                      .map((message) => (message.content.type === "text" ? message.content.text : ""))
                      .join("\n") || "",
                  )
                })
              },
              hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
            }
          }

          // Add skills as invokable commands
          for (const skill of await Skill.all()) {
            // Skip if a command with this name already exists
            if (commands[skill.name]) continue
            commands[skill.name] = {
              name: skill.name,
              description: skill.description,
              source: "skill",
              get template() {
                return skill.content
              },
              hints: [],
            }
          }
        })
      })

      const loadFiber = yield* load().pipe(
        Effect.catchCause((cause) => Effect.sync(() => log.error("init failed", { cause }))),
        Effect.forkScoped,
      )

      const get = Effect.fn("Command.get")(function* (name: string) {
        yield* Fiber.join(loadFiber)
        return commands[name]
      })

      const list = Effect.fn("Command.list")(function* () {
        yield* Fiber.join(loadFiber)
        return Object.values(commands)
      })

      return Service.of({ get, list })
    }),
  )

  export async function get(name: string) {
    return runPromiseInstance(Service.use((svc) => svc.get(name)))
  }

  export async function list() {
    return runPromiseInstance(Service.use((svc) => svc.list()))
  }
}
