import { PlanExitTool } from "./plan"
import { QuestionTool } from "./question"
import { BashTool } from "./bash"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { BatchTool } from "./batch"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { TodoWriteTool, TodoReadTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import { SkillTool } from "./skill"
import type { Agent } from "../agent/agent"
import { Tool } from "./tool"
import { Config } from "../config/config"
import path from "path"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@opencode-ai/plugin"
import z from "zod"
import { Plugin } from "../plugin"
import { ProviderID, type ModelID } from "../provider/schema"
import { WebSearchTool } from "./websearch"
import { CodeSearchTool } from "./codesearch"
import { Flag } from "@/flag/flag"
import { Log } from "@/util/log"
import { LspTool } from "./lsp"
import { Truncate } from "./truncate"

import { ApplyPatchTool } from "./apply_patch"
import { Glob } from "../util/glob"
import { pathToFileURL } from "url"
import { Effect, Fiber, Layer, ServiceMap } from "effect"
import { InstanceContext } from "@/effect/instance-context"
import { runPromiseInstance } from "@/effect/runtime"

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

  export interface Interface {
    readonly register: (tool: Tool.Info) => Effect.Effect<void>
    readonly ids: () => Effect.Effect<string[]>
    readonly tools: (
      model: { providerID: ProviderID; modelID: ModelID },
      agent?: Agent.Info,
    ) => Effect.Effect<(Awaited<ReturnType<Tool.Info["init"]>> & { id: string })[]>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/ToolRegistry") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const instance = yield* InstanceContext

      const custom: Tool.Info[] = []

      const load = Effect.fn("ToolRegistry.load")(function* () {
        yield* Effect.promise(async () => {
          const matches = await Config.directories().then((dirs) =>
            dirs.flatMap((dir) =>
              Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
            ),
          )
          if (matches.length) await Config.waitForDependencies()
          for (const match of matches) {
            const namespace = path.basename(match, path.extname(match))
            const mod = await import(pathToFileURL(match).href)
            for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
              custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
            }
          }

          const plugins = await Plugin.list()
          for (const plugin of plugins) {
            for (const [id, def] of Object.entries(plugin.tool ?? {})) {
              custom.push(fromPlugin(id, def))
            }
          }
        })
      })

      const loadFiber = yield* load().pipe(
        Effect.catchCause((cause) => Effect.sync(() => log.error("init failed", { cause }))),
        Effect.forkScoped,
      )

      function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
        return {
          id,
          init: async (initCtx) => ({
            parameters: z.object(def.args),
            description: def.description,
            execute: async (args, ctx) => {
              const pluginCtx = {
                ...ctx,
                directory: instance.directory,
                worktree: instance.worktree,
              } as unknown as PluginToolContext
              const result = await def.execute(args as any, pluginCtx)
              const out = await Truncate.output(result, {}, initCtx?.agent)
              return {
                title: "",
                output: out.truncated ? out.content : result,
                metadata: { truncated: out.truncated, outputPath: out.truncated ? out.outputPath : undefined },
              }
            },
          }),
        }
      }

      async function all(): Promise<Tool.Info[]> {
        const config = await Config.get()
        const question = ["app", "cli", "desktop"].includes(Flag.OPENCODE_CLIENT) || Flag.OPENCODE_ENABLE_QUESTION_TOOL

        return [
          InvalidTool,
          ...(question ? [QuestionTool] : []),
          BashTool,
          ReadTool,
          GlobTool,
          GrepTool,
          EditTool,
          WriteTool,
          TaskTool,
          WebFetchTool,
          TodoWriteTool,
          // TodoReadTool,
          WebSearchTool,
          CodeSearchTool,
          SkillTool,
          ApplyPatchTool,
          ...(Flag.OPENCODE_EXPERIMENTAL_LSP_TOOL ? [LspTool] : []),
          ...(config.experimental?.batch_tool === true ? [BatchTool] : []),
          ...(Flag.OPENCODE_EXPERIMENTAL_PLAN_MODE && Flag.OPENCODE_CLIENT === "cli" ? [PlanExitTool] : []),
          ...custom,
        ]
      }

      const register = Effect.fn("ToolRegistry.register")(function* (tool: Tool.Info) {
        yield* Fiber.join(loadFiber)
        const idx = custom.findIndex((t) => t.id === tool.id)
        if (idx >= 0) {
          custom.splice(idx, 1, tool)
          return
        }
        custom.push(tool)
      })

      const ids = Effect.fn("ToolRegistry.ids")(function* () {
        yield* Fiber.join(loadFiber)
        const tools = yield* Effect.promise(() => all())
        return tools.map((t) => t.id)
      })

      const tools = Effect.fn("ToolRegistry.tools")(function* (
        model: { providerID: ProviderID; modelID: ModelID },
        agent?: Agent.Info,
      ) {
        yield* Fiber.join(loadFiber)
        const allTools = yield* Effect.promise(() => all())
        return yield* Effect.promise(() =>
          Promise.all(
            allTools
              .filter((t) => {
                // Enable websearch/codesearch for zen users OR via enable flag
                if (t.id === "codesearch" || t.id === "websearch") {
                  return model.providerID === ProviderID.opencode || Flag.OPENCODE_ENABLE_EXA
                }

                // use apply tool in same format as codex
                const usePatch =
                  model.modelID.includes("gpt-") && !model.modelID.includes("oss") && !model.modelID.includes("gpt-4")
                if (t.id === "apply_patch") return usePatch
                if (t.id === "edit" || t.id === "write") return !usePatch

                return true
              })
              .map(async (t) => {
                using _ = log.time(t.id)
                const tool = await t.init({ agent })
                const output = {
                  description: tool.description,
                  parameters: tool.parameters,
                }
                await Plugin.trigger("tool.definition", { toolID: t.id }, output)
                return {
                  id: t.id,
                  ...tool,
                  description: output.description,
                  parameters: output.parameters,
                }
              }),
          ),
        )
      })

      return Service.of({ register, ids, tools })
    }),
  )

  export async function register(tool: Tool.Info) {
    return runPromiseInstance(Service.use((svc) => svc.register(tool)))
  }

  export async function ids() {
    return runPromiseInstance(Service.use((svc) => svc.ids()))
  }

  export async function tools(
    model: {
      providerID: ProviderID
      modelID: ModelID
    },
    agent?: Agent.Info,
  ) {
    return runPromiseInstance(Service.use((svc) => svc.tools(model, agent)))
  }
}
