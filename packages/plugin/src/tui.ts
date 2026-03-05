import type { createOpencodeClient as createOpencodeClientV2, Event as TuiEvent } from "@opencode-ai/sdk/v2"
import type { CliRenderer, ParsedKey, Plugin as CorePlugin } from "@opentui/core"
import type { Plugin as ServerPlugin, PluginOptions } from "./index"

export type { CliRenderer, SlotMode } from "@opentui/core"

type HexColor = `#${string}`
type RefName = string
type Variant = {
  dark: HexColor | RefName | number
  light: HexColor | RefName | number
}
type ThemeColorValue = HexColor | RefName | number | Variant

export type ThemeJson = {
  $schema?: string
  defs?: Record<string, HexColor | RefName>
  theme: Record<string, ThemeColorValue> & {
    selectedListItemText?: ThemeColorValue
    backgroundMenu?: ThemeColorValue
    thinkingOpacity?: number
  }
}

export type TuiRoute =
  | {
      type: "home"
    }
  | {
      type: "session"
      sessionID: string
    }
  | {
      type: "plugin"
      id: string
      data?: Record<string, unknown>
    }

export type TuiCommand = {
  title: string
  value: string
  description?: string
  category?: string
  keybind?: string
  suggested?: boolean
  hidden?: boolean
  enabled?: boolean
  slash?: {
    name: string
    aliases?: string[]
  }
  onSelect?: () => void
}

export type TuiKeybind = {
  name: string
  ctrl: boolean
  meta: boolean
  shift: boolean
  super?: boolean
  leader: boolean
}

export type TuiApi<Node = unknown> = {
  command: {
    register: (cb: () => TuiCommand[]) => void
    trigger: (value: string) => void
  }
  dialog: {
    clear: () => void
    replace: (input: Node | (() => Node), onClose?: () => void) => void
    readonly depth: number
  }
  route: {
    readonly data: TuiRoute
    navigate: (route: TuiRoute) => void
    home: () => void
    plugin: (id: string, data?: Record<string, unknown>) => void
  }
  keybind: {
    parse: (evt: ParsedKey) => TuiKeybind
    match: (key: string, evt: ParsedKey) => boolean
    print: (key: string) => string
  }
  theme: {
    readonly current: Record<string, unknown>
  }
}

export type TuiSlotMap = {
  app: {}
  route: {
    route_id: string
    data?: Record<string, unknown>
  }
  home_logo: {}
  sidebar_top: {
    session_id: string
  }
}

export type TuiSlotContext = {}

export type TuiSlotPlugin<Node = unknown> = CorePlugin<Node, TuiSlotMap, TuiSlotContext>

export type TuiSlots = {
  register: (plugin: TuiSlotPlugin) => () => void
}

export type TuiEventBus = {
  on: <Type extends TuiEvent["type"]>(
    type: Type,
    handler: (event: Extract<TuiEvent, { type: Type }>) => void,
  ) => () => void
}

export type TuiPluginInput<Renderer = CliRenderer, Node = unknown> = {
  client: ReturnType<typeof createOpencodeClientV2>
  event: TuiEventBus
  renderer: Renderer
  slots: TuiSlots
  api: TuiApi<Node>
}

export type TuiPlugin<Renderer = CliRenderer, Node = unknown> = (
  input: TuiPluginInput<Renderer, Node>,
  options?: PluginOptions,
) => Promise<void>

export type TuiPluginModule<Renderer = CliRenderer, Node = unknown> = {
  server?: ServerPlugin
  tui?: TuiPlugin<Renderer, Node>
  slots?: TuiSlotPlugin
  themes?: Record<string, ThemeJson>
}
