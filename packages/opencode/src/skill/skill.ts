import path from "path"
import { pathToFileURL } from "url"
import z from "zod"
import { Effect, Fiber, Layer, ServiceMap } from "effect"
import { NamedError } from "@opencode-ai/util/error"
import type { Agent } from "@/agent/agent"
import { Bus } from "@/bus"
import { AppFileSystem } from "@/filesystem"
import { InstanceContext } from "@/effect/instance-context"
import { runPromiseInstance } from "@/effect/runtime"
import { Flag } from "@/flag/flag"
import { Global } from "@/global"
import { PermissionNext } from "@/permission"
import { Filesystem } from "@/util/filesystem"
import { Config } from "../config/config"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"
import { Discovery } from "./discovery"

export namespace Skill {
  const log = Log.create({ service: "skill" })
  const EXTERNAL_DIRS = [".claude", ".agents"]
  const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
  const SKILL_PATTERN = "**/SKILL.md"

  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    content: z.string(),
  })
  export type Info = z.infer<typeof Info>

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  )

  type State = {
    skills: Record<string, Info>
    dirs: Set<string>
  }

  export interface Interface {
    readonly get: (name: string) => Effect.Effect<Info | undefined>
    readonly all: () => Effect.Effect<Info[]>
    readonly dirs: () => Effect.Effect<string[]>
    readonly available: (agent?: Agent.Info) => Effect.Effect<Info[]>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Skill") {}

  export const layer: Layer.Layer<Service, never, InstanceContext | Discovery.Service | AppFileSystem.Service> =
    Layer.effect(
      Service,
      Effect.gen(function* () {
        const instance = yield* InstanceContext
        const discovery = yield* Discovery.Service
        const fs = yield* AppFileSystem.Service

        const state: State = {
          skills: {},
          dirs: new Set<string>(),
        }

        const add = Effect.fn("Skill.add")(function* (match: string) {
          const md = yield* Effect.tryPromise(() => ConfigMarkdown.parse(match)).pipe(
            Effect.catch((err) =>
              Effect.gen(function* () {
                const message = ConfigMarkdown.FrontmatterError.isInstance(err)
                  ? err.data.message
                  : `Failed to parse skill ${match}`
                const { Session } = yield* Effect.promise(() => import("@/session"))
                Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
                log.error("failed to load skill", { skill: match, err })
                return undefined
              }),
            ),
          )

          if (!md) return

          const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
          if (!parsed.success) return

          if (state.skills[parsed.data.name]) {
            log.warn("duplicate skill name", {
              name: parsed.data.name,
              existing: state.skills[parsed.data.name].location,
              duplicate: match,
            })
          }

          state.dirs.add(path.dirname(match))
          state.skills[parsed.data.name] = {
            name: parsed.data.name,
            description: parsed.data.description,
            location: match,
            content: md.content,
          }
        })

        const scan = Effect.fn("Skill.scan")(function* (
          root: string,
          pattern: string,
          opts?: { dot?: boolean; scope?: string },
        ) {
          const matches = yield* fs
            .glob(pattern, {
              cwd: root,
              absolute: true,
              include: "file",
              symlink: true,
              dot: opts?.dot,
            })
            .pipe(
              Effect.catch((error) => {
                if (!opts?.scope) return Effect.fail(error)
                return Effect.sync(() => {
                  log.error(`failed to scan ${opts.scope} skills`, { dir: root, error })
                  return [] as string[]
                })
              }),
            )

          yield* Effect.forEach(matches, (match) => add(match), { concurrency: "unbounded" })
        })

        const load = Effect.fn("Skill.load")(function* () {
          // Phase 1: External dirs (global)
          if (!Flag.OPENCODE_DISABLE_EXTERNAL_SKILLS) {
            for (const dir of EXTERNAL_DIRS) {
              const root = path.join(Global.Path.home, dir)
              if (!(yield* fs.isDir(root).pipe(Effect.orDie))) continue
              yield* scan(root, EXTERNAL_SKILL_PATTERN, { dot: true, scope: "global" })
            }

            // Phase 2: External dirs (project, walk up)
            const roots = yield* fs
              .up({
                targets: EXTERNAL_DIRS,
                start: instance.directory,
                stop: instance.project.worktree,
              })
              .pipe(Effect.orDie)

            yield* Effect.forEach(
              roots,
              (root) => scan(root, EXTERNAL_SKILL_PATTERN, { dot: true, scope: "project" }),
              { concurrency: "unbounded" },
            )
          }

          // Phase 3: Config directories
          const dirs = yield* Effect.promise(() => Config.directories())
          yield* Effect.forEach(dirs, (dir) => scan(dir, OPENCODE_SKILL_PATTERN), { concurrency: "unbounded" })

          // Phase 4: Custom paths
          const cfg = yield* Effect.promise(() => Config.get())
          for (const item of cfg.skills?.paths ?? []) {
            const expanded = Filesystem.expandHome(item)
            const dir = path.isAbsolute(expanded) ? expanded : path.join(instance.directory, expanded)
            if (!(yield* fs.isDir(dir).pipe(Effect.orDie))) {
              log.warn("skill path not found", { path: dir })
              continue
            }

            yield* scan(dir, SKILL_PATTERN)
          }

          // Phase 5: Remote URLs
          for (const url of cfg.skills?.urls ?? []) {
            const pullDirs = yield* discovery.pull(url)
            for (const dir of pullDirs) {
              state.dirs.add(dir)
              yield* scan(dir, SKILL_PATTERN)
            }
          }

          log.info("init", { count: Object.keys(state.skills).length })
        })

        const loadFiber = yield* load().pipe(
          Effect.catchCause((cause) => Effect.sync(() => log.error("init failed", { cause }))),
          Effect.forkScoped,
        )

        const get = Effect.fn("Skill.get")(function* (name: string) {
          yield* Fiber.join(loadFiber)
          return state.skills[name]
        })

        const all = Effect.fn("Skill.all")(function* () {
          yield* Fiber.join(loadFiber)
          return Object.values(state.skills)
        })

        const dirs = Effect.fn("Skill.dirs")(function* () {
          yield* Fiber.join(loadFiber)
          return Array.from(state.dirs)
        })

        const available = Effect.fn("Skill.available")(function* (agent?: Agent.Info) {
          yield* Fiber.join(loadFiber)
          const list = Object.values(state.skills)
          if (!agent) return list
          return list.filter((skill) => PermissionNext.evaluate("skill", skill.name, agent.permission).action !== "deny")
        })

        return Service.of({ get, all, dirs, available })
      }),
    )

  export const defaultLayer: Layer.Layer<Service, never, InstanceContext> = layer.pipe(
    Layer.provide(Discovery.defaultLayer),
    Layer.provide(AppFileSystem.defaultLayer),
  )

  export async function get(name: string) {
    return runPromiseInstance(Service.use((skill) => skill.get(name)))
  }

  export async function all() {
    return runPromiseInstance(Service.use((skill) => skill.all()))
  }

  export async function dirs() {
    return runPromiseInstance(Service.use((skill) => skill.dirs()))
  }

  export async function available(agent?: Agent.Info) {
    return runPromiseInstance(Service.use((skill) => skill.available(agent)))
  }

  export function fmt(list: Info[], opts: { verbose: boolean }) {
    if (list.length === 0) return "No skills are currently available."

    if (opts.verbose) {
      return [
        "<available_skills>",
        ...list.flatMap((skill) => [
          "  <skill>",
          `    <name>${skill.name}</name>`,
          `    <description>${skill.description}</description>`,
          `    <location>${pathToFileURL(skill.location).href}</location>`,
          "  </skill>",
        ]),
        "</available_skills>",
      ].join("\n")
    }

    return ["## Available Skills", ...list.map((skill) => `- **${skill.name}**: ${skill.description}`)].join("\n")
  }
}
