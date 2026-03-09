import {
  type TuiPlugin as TuiPluginFn,
  type TuiPluginInit,
  type TuiPluginInput,
  type TuiTheme,
  type TuiSlotContext,
  type TuiSlotMap,
  type TuiSlots,
  type SlotMode,
} from "@opencode-ai/plugin/tui"
import { createSlot, createSolidSlotRegistry, type JSX, type SolidPlugin } from "@opentui/solid"
import type { CliRenderer } from "@opentui/core"
import "@opentui/solid/preload"
import path from "path"
import { fileURLToPath } from "url"

import { Config } from "@/config/config"
import { TuiConfig } from "@/config/tui"
import { Log } from "@/util/log"
import { isRecord } from "@/util/record"
import { Instance } from "@/project/instance"
import { resolvePluginTarget, uniqueModuleEntries } from "@/plugin/shared"
import { PluginMeta } from "@/plugin/meta"
import { addTheme, hasTheme } from "./context/theme"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"

type SlotProps<K extends keyof TuiSlotMap> = {
  name: K
  mode?: SlotMode
  children?: JSX.Element
} & TuiSlotMap[K]

type Slot = <K extends keyof TuiSlotMap>(props: SlotProps<K>) => JSX.Element | null
type InitInput = Omit<TuiPluginInput<CliRenderer>, "slots">

function empty<K extends keyof TuiSlotMap>(_props: SlotProps<K>) {
  return null
}

function isTuiSlotPlugin(value: unknown): value is SolidPlugin<TuiSlotMap, TuiSlotContext> {
  if (!isRecord(value)) return false
  if (typeof value.id !== "string") return false
  if (!isRecord(value.slots)) return false
  return true
}

function getTuiSlotPlugin(value: unknown) {
  if (isTuiSlotPlugin(value)) return value
  if (!isRecord(value)) return
  if (!isTuiSlotPlugin(value.slots)) return
  return value.slots
}

function isTuiPlugin(value: unknown): value is TuiPluginFn<CliRenderer> {
  return typeof value === "function"
}

function getTuiPlugin(value: unknown) {
  if (!isRecord(value) || !("tui" in value)) return
  if (!isTuiPlugin(value.tui)) return
  return value.tui
}

function isTheme(value: unknown) {
  if (!isRecord(value)) return false
  if (!isRecord(value.theme)) return false
  return true
}

function localDir(file: string) {
  const dir = path.dirname(file)
  if (path.basename(dir) === ".opencode") return path.join(dir, "themes")
  return path.join(dir, ".opencode", "themes")
}

function scopeDir(pluginMeta: TuiConfig.PluginMeta) {
  if (pluginMeta.scope === "local") return localDir(pluginMeta.source)
  return path.join(Global.Path.config, "themes")
}

function pluginRoot(spec: string, target: string) {
  if (spec.startsWith("file://")) return path.dirname(fileURLToPath(spec))
  if (target.startsWith("file://")) return path.dirname(fileURLToPath(target))
  return target
}

function resolveThemePath(root: string, file: string) {
  if (file.startsWith("file://")) return fileURLToPath(file)
  if (path.isAbsolute(file)) return file
  return path.resolve(root, file)
}

function themeName(file: string) {
  return path.basename(file, path.extname(file))
}

function getPluginMeta(config: TuiConfig.Info, item: Config.PluginSpec) {
  const key = Config.getPluginName(item)
  const value = config.plugin_meta?.[key]
  if (!value) {
    throw new Error(`missing plugin metadata for ${key}`)
  }
  return value
}

function makeInstallFn(meta: TuiConfig.PluginMeta, root: string): TuiTheme["install"] {
  return async (file) => {
    const src = resolveThemePath(root, file)
    const theme = themeName(src)
    if (hasTheme(theme)) return

    const text = await Bun.file(src)
      .text()
      .catch((error) => {
        throw new Error(`failed to read theme at ${src}: ${error}`)
      })
    const data = JSON.parse(text)
    if (!isTheme(data)) {
      throw new Error(`invalid theme at ${src}`)
    }

    const dest = path.join(scopeDir(meta), `${theme}.json`)
    if (!(await Filesystem.exists(dest))) {
      await Filesystem.write(dest, text)
    }

    addTheme(theme, data)
  }
}

export namespace TuiPlugin {
  const log = Log.create({ service: "tui.plugin" })
  let loaded: Promise<void> | undefined
  let view: Slot = empty

  export const Slot: Slot = (props) => view(props)

  function setupSlots(input: InitInput): TuiSlots {
    const reg = createSolidSlotRegistry<TuiSlotMap, TuiSlotContext>(
      input.renderer,
      {
        theme: input.api.theme,
      },
      {
        onPluginError(event) {
          console.error("[tui.slot] plugin error", {
            plugin: event.pluginId,
            slot: event.slot,
            phase: event.phase,
            source: event.source,
            message: event.error.message,
          })
        },
      },
    )

    const slot = createSlot<TuiSlotMap, TuiSlotContext>(reg)
    view = (props) => slot(props)
    return {
      register(pluginSlot) {
        if (!isTuiSlotPlugin(pluginSlot)) return () => {}
        return reg.register(pluginSlot)
      },
    }
  }

  export async function init(input: InitInput) {
    if (loaded) return loaded
    loaded = load({
      ...input,
      slots: setupSlots(input),
    })
    return loaded
  }

  async function load(input: TuiPluginInput<CliRenderer>) {
    const dir = process.cwd()

    await Instance.provide({
      directory: dir,
      fn: async () => {
        const config = await TuiConfig.get()
        const plugins = config.plugin ?? []
        let deps: Promise<void> | undefined
        const wait = async () => {
          if (deps) {
            await deps
            return
          }
          deps = TuiConfig.waitForDependencies().catch((error) => {
            log.warn("failed waiting for tui plugin dependencies", { error })
          })
          await deps
        }

        const prep = async (item: (typeof plugins)[number], retry = false) => {
          const spec = Config.pluginSpecifier(item)
          log.info("loading tui plugin", { path: spec, retry })
          const target = await resolvePluginTarget(spec).catch((error) => {
            log.error("failed to resolve tui plugin", { path: spec, retry, error })
            return
          })
          if (!target) return
          const meta = await PluginMeta.touch(spec, target).catch((error) => {
            log.warn("failed to track tui plugin", { path: spec, retry, error })
          })
          if (meta && meta.state !== "same") {
            log.info("tui plugin metadata updated", {
              path: spec,
              retry,
              state: meta.state,
              source: meta.entry.source,
              version: meta.entry.version,
              modified: meta.entry.modified,
            })
          }

          const now = Date.now()
          const init: TuiPluginInit = meta
            ? {
                state: meta.state,
                first: meta.state === "new",
                updated: meta.state === "changed",
                entry: meta.entry,
              }
            : {
                state: "new",
                first: true,
                updated: false,
                entry: {
                  name: spec,
                  source: spec.startsWith("file://") ? "file" : "npm",
                  spec,
                  target,
                  first_time: now,
                  last_time: now,
                  time_changed: now,
                  load_count: 1,
                  fingerprint: target,
                },
              }

          const root = pluginRoot(spec, target)
          const install = makeInstallFn(getPluginMeta(config, item), root)
          const mod = await import(target).catch((error) => {
            log.error("failed to load tui plugin", { path: spec, retry, error })
            return
          })
          if (!mod) return

          return {
            item,
            spec,
            mod,
            install,
            init,
          }
        }

        try {
          const loaded = await Promise.all(plugins.map((item) => prep(item)))

          for (let i = 0; i < plugins.length; i++) {
            let load = loaded[i]
            if (!load) {
              const item = plugins[i]
              if (!item) continue
              const spec = Config.pluginSpecifier(item)
              if (!spec.startsWith("file://")) continue
              await wait()
              load = await prep(item, true)
            }
            if (!load) continue

            // Keep plugin execution sequential for deterministic side effects:
            // command registration order affects keybind/command precedence,
            // route registration is last-wins when ids collide,
            // and hook chains rely on stable plugin ordering.
            for (const [name, value] of uniqueModuleEntries(load.mod)) {
              if (!value || typeof value !== "object") {
                log.warn("ignoring non-object tui plugin export", {
                  path: load.spec,
                  name,
                  type: value === null ? "null" : typeof value,
                })
                continue
              }

              const slotPlugin = getTuiSlotPlugin(value)
              if (slotPlugin) input.slots.register(slotPlugin)

              const tuiPlugin = getTuiPlugin(value)
              if (!tuiPlugin) continue
              await tuiPlugin(
                {
                  ...input,
                  api: {
                    command: input.api.command,
                    route: input.api.route,
                    ui: input.api.ui,
                    keybind: input.api.keybind,
                    theme: Object.create(input.api.theme, {
                      install: {
                        value: load.install,
                        configurable: true,
                        enumerable: true,
                      },
                    }),
                  },
                },
                Config.pluginOptions(load.item) ?? null,
                load.init,
              )
            }
          }
        } finally {
          await PluginMeta.persist().catch((error) => {
            log.warn("failed to persist tui plugin metadata", { error })
          })
        }
      },
    }).catch((error) => {
      log.error("failed to load tui plugins", { directory: dir, error })
    })
  }
}
