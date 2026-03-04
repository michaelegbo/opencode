import type { Hooks, PluginInput, Plugin as PluginInstance } from "@opencode-ai/plugin"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { Server } from "../server/server"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { CodexAuthPlugin } from "./codex"
import { Session } from "../session"
import { NamedError } from "@opencode-ai/util/error"
import { CopilotAuthPlugin } from "./copilot"
import { parsePluginSpecifier, resolvePluginTarget, uniqueModuleEntries } from "./shared"
import { gitlabAuthPlugin as GitlabAuthPlugin } from "@gitlab/opencode-gitlab-auth"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  const BUILTIN = ["opencode-anthropic-auth@0.0.13"]

  // Built-in plugins that are directly imported (not installed from npm)
  const INTERNAL_PLUGINS: PluginInstance[] = [CodexAuthPlugin, CopilotAuthPlugin, GitlabAuthPlugin]

  const state = Instance.state(async () => {
    const client = createOpencodeClient({
      baseUrl: "http://localhost:4096",
      directory: Instance.directory,
      fetch: async (...args) => Server.Default().fetch(...args),
    })
    const config = await Config.get()
    const hooks: Hooks[] = []
    const input: PluginInput = {
      client,
      project: Instance.project,
      worktree: Instance.worktree,
      directory: Instance.directory,
      get serverUrl(): URL {
        throw new Error("Server URL is no longer supported in plugins")
      },
      $: Bun.$,
    }

    for (const plugin of INTERNAL_PLUGINS) {
      log.info("loading internal plugin", { name: plugin.name })
      const init = await plugin(input).catch((err) => {
        log.error("failed to load internal plugin", { name: plugin.name, error: err })
      })
      if (init) hooks.push(init)
    }

    let plugins = config.plugin ?? []
    if (plugins.length) await Config.waitForDependencies()
    if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS) {
      plugins = [...BUILTIN, ...plugins]
    }

    async function resolve(spec: string) {
      const parsed = parsePluginSpecifier(spec)
      const builtIn = BUILTIN.some((x) => x.startsWith(parsed.pkg + "@"))
      const target = await resolvePluginTarget(spec, parsed).catch((err) => {
        const cause = err instanceof Error ? err.cause : err
        const detail = cause instanceof Error ? cause.message : String(cause ?? err)
        log.error("failed to install plugin", { pkg: parsed.pkg, version: parsed.version, error: detail })
        const label = builtIn ? "built-in plugin" : "plugin"
        Bus.publish(Session.Event.Error, {
          error: new NamedError.Unknown({
            message: `Failed to install ${label} ${parsed.pkg}@${parsed.version}: ${detail}`,
          }).toObject(),
        })
        return ""
      })
      if (!target) return
      return target
    }

    function isServerPlugin(value: unknown): value is PluginInstance {
      return typeof value === "function"
    }

    function getServerPlugin(value: unknown) {
      if (isServerPlugin(value)) return value
      if (!value || typeof value !== "object" || !("server" in value)) return
      if (!isServerPlugin(value.server)) return
      return value.server
    }

    for (const item of plugins) {
      const spec = Config.pluginSpecifier(item)
      // ignore old codex plugin since it is supported first party now
      if (spec.includes("opencode-openai-codex-auth") || spec.includes("opencode-copilot-auth")) continue
      log.info("loading plugin", { path: spec })
      const path = await resolve(spec)
      if (!path) continue
      const mod = await import(path).catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        log.error("failed to load plugin", { path: spec, error: message })
        Bus.publish(Session.Event.Error, {
          error: new NamedError.Unknown({
            message: `Failed to load plugin ${spec}: ${message}`,
          }).toObject(),
        })
        return
      })
      if (!mod) continue

      // Prevent duplicate initialization when plugins export the same function
      // as both a named export and default export (e.g., `export const X` and `export default X`).
      // uniqueModuleEntries keeps only the first export for each shared value reference.
      for (const [, entry] of uniqueModuleEntries(mod)) {
        const server = getServerPlugin(entry)
        if (!server) continue
        const init = await server(input, Config.pluginOptions(item)).catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          log.error("failed to initialize plugin", { path: spec, error: message })
          Bus.publish(Session.Event.Error, {
            error: new NamedError.Unknown({
              message: `Failed to initialize plugin ${spec}: ${message}`,
            }).toObject(),
          })
          return
        })
        if (!init) continue
        hooks.push(init)
      }
    }

    return {
      hooks,
      input,
    }
  })

  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    for (const hook of await state().then((x) => x.hooks)) {
      const fn = hook[name]
      if (!fn) continue
      // @ts-expect-error if you feel adventurous, please fix the typing, make sure to bump the try-counter if you
      // give up.
      // try-counter: 2
      await fn(input, output)
    }
    return output
  }

  export async function list() {
    return state().then((x) => x.hooks)
  }

  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    for (const hook of hooks) {
      // @ts-expect-error this is because we haven't moved plugin to sdk v2
      await hook.config?.(config)
    }
    Bus.subscribeAll(async (input) => {
      const hooks = await state().then((x) => x.hooks)
      for (const hook of hooks) {
        hook["event"]?.({
          event: input,
        })
      }
    })
  }
}
