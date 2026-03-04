import {
  type TuiPlugin as TuiPluginFn,
  type TuiPluginInput,
  type TuiSlotContext,
  type TuiSlotMap,
  type TuiSlots,
  type SlotMode,
} from "@opencode-ai/plugin/tui"
import { createSlot, createSolidSlotRegistry, type JSX, type SolidPlugin } from "@opentui/solid"
import type { CliRenderer } from "@opentui/core"
import "@opentui/solid/preload"

import { Config } from "@/config/config"
import { TuiConfig } from "@/config/tui"
import { Log } from "@/util/log"
import { isRecord } from "@/util/record"
import { Instance } from "@/project/instance"
import { resolvePluginTarget, uniqueModuleEntries } from "@/plugin/shared"
import { registerThemes } from "./context/theme"

type SlotInput<K extends keyof TuiSlotMap> = {
  name: K
  mode?: SlotMode
  slotMode?: SlotMode
  children?: JSX.Element
} & TuiSlotMap[K]

type SlotProps<K extends keyof TuiSlotMap> = {
  name: K
  mode?: SlotMode
  children?: JSX.Element
} & TuiSlotMap[K]

type Slot = <K extends keyof TuiSlotMap>(props: SlotInput<K>) => JSX.Element | null
type InitInput = Omit<TuiPluginInput<CliRenderer>, "slots">

function normalize<K extends keyof TuiSlotMap>(props: SlotInput<K>): SlotProps<K> {
  const { slotMode, ...rest } = props
  if (!slotMode || rest.mode) return rest as SlotProps<K>
  return { ...rest, mode: slotMode } as SlotProps<K>
}

function empty<K extends keyof TuiSlotMap>(_props: SlotInput<K>) {
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

function getThemes(value: unknown) {
  if (!isRecord(value) || !("themes" in value)) return
  if (!isRecord(value.themes)) return
  return value.themes
}

function isTuiPlugin(value: unknown): value is TuiPluginFn<CliRenderer> {
  return typeof value === "function"
}

function getTuiPlugin(value: unknown) {
  if (!isRecord(value) || !("tui" in value)) return
  if (!isTuiPlugin(value.tui)) return
  return value.tui
}

export namespace TuiPlugin {
  const log = Log.create({ service: "tui.plugin" })
  let loaded: Promise<void> | undefined
  let view: Slot = empty

  export const Slot: Slot = (props) => view(props)

  function setupSlots(renderer: CliRenderer): TuiSlots {
    const reg = createSolidSlotRegistry<TuiSlotMap, TuiSlotContext>(
      renderer,
      {},
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
    view = (props) => slot(normalize(props))
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
      slots: setupSlots(input.renderer),
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
        if (plugins.length) await TuiConfig.waitForDependencies()

        for (const item of plugins) {
          const spec = Config.pluginSpecifier(item)
          log.info("loading tui plugin", { path: spec })
          const target = await resolvePluginTarget(spec).catch((error) => {
            log.error("failed to resolve tui plugin", { path: spec, error })
            return
          })
          if (!target) continue

          const mod = await import(target).catch((error) => {
            log.error("failed to load tui plugin", { path: spec, error })
            return
          })
          if (!mod) continue

          for (const [name, entry] of uniqueModuleEntries(mod)) {
            if (!entry || typeof entry !== "object") {
              log.warn("ignoring non-object tui plugin export", {
                path: spec,
                name,
                type: entry === null ? "null" : typeof entry,
              })
              continue
            }

            const theme = getThemes(entry)
            if (theme) registerThemes(theme)

            const slotPlugin = getTuiSlotPlugin(entry)
            if (slotPlugin) input.slots.register(slotPlugin)

            const tuiPlugin = getTuiPlugin(entry)
            if (!tuiPlugin) continue
            await tuiPlugin(input, Config.pluginOptions(item))
          }
        }
      },
    }).catch((error) => {
      log.error("failed to load tui plugins", { directory: dir, error })
    })
  }
}
