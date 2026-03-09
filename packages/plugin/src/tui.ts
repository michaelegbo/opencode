import type { createOpencodeClient as createOpencodeClientV2, Event as TuiEvent } from "@opencode-ai/sdk/v2"
import type { CliRenderer, ParsedKey, Plugin as CorePlugin } from "@opentui/core"
import type { Plugin as ServerPlugin, PluginOptions } from "./index"

export type { CliRenderer, SlotMode } from "@opentui/core"

export type TuiRouteCurrent =
  | {
      name: "home"
    }
  | {
      name: "session"
      params: {
        sessionID: string
        initialPrompt?: unknown
      }
    }
  | {
      name: string
      params?: Record<string, unknown>
    }

export type TuiRouteDefinition<Node = unknown> = {
  name: string
  render: (input: { params?: Record<string, unknown> }) => Node
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

export type TuiKeybindMap = Record<string, string>

export type TuiKeybindSet = {
  readonly all: TuiKeybindMap
  get: (name: string) => string
  parse: (evt: ParsedKey) => TuiKeybind
  match: (name: string, evt: ParsedKey) => boolean
  print: (name: string) => string
}

export type TuiDialogProps<Node = unknown> = {
  size?: "medium" | "large"
  onClose: () => void
  children?: Node
}

export type TuiDialogStack<Node = unknown> = {
  replace: (render: () => Node, onClose?: () => void) => void
  clear: () => void
  setSize: (size: "medium" | "large") => void
  readonly size: "medium" | "large"
  readonly depth: number
  readonly open: boolean
}

export type TuiDialogAlertProps = {
  title: string
  message: string
  onConfirm?: () => void
}

export type TuiDialogConfirmProps = {
  title: string
  message: string
  onConfirm?: () => void
  onCancel?: () => void
}

export type TuiDialogPromptProps<Node = unknown> = {
  title: string
  description?: () => Node
  placeholder?: string
  value?: string
  onConfirm?: (value: string) => void
  onCancel?: () => void
}

export type TuiDialogSelectOption<Value = unknown, Node = unknown> = {
  title: string
  value: Value
  description?: string
  footer?: Node | string
  category?: string
  disabled?: boolean
  onSelect?: () => void
}

export type TuiDialogSelectProps<Value = unknown, Node = unknown> = {
  title: string
  placeholder?: string
  options: TuiDialogSelectOption<Value, Node>[]
  flat?: boolean
  onMove?: (option: TuiDialogSelectOption<Value, Node>) => void
  onFilter?: (query: string) => void
  onSelect?: (option: TuiDialogSelectOption<Value, Node>) => void
  skipFilter?: boolean
  current?: Value
}

export type TuiToast = {
  variant?: "info" | "success" | "warning" | "error"
  title?: string
  message: string
  duration?: number
}

export type TuiTheme = {
  readonly current: Record<string, unknown>
  readonly selected: string
  has: (name: string) => boolean
  set: (name: string) => boolean
  install: (jsonPath: string) => Promise<void>
  mode: () => "dark" | "light"
  readonly ready: boolean
}

export type TuiApi<Node = unknown> = {
  command: {
    register: (cb: () => TuiCommand[]) => void
    trigger: (value: string) => void
  }
  route: {
    register: (routes: TuiRouteDefinition<Node>[]) => () => void
    navigate: (name: string, params?: Record<string, unknown>) => void
    readonly current: TuiRouteCurrent
  }
  ui: {
    Dialog: (props: TuiDialogProps<Node>) => Node
    DialogAlert: (props: TuiDialogAlertProps) => Node
    DialogConfirm: (props: TuiDialogConfirmProps) => Node
    DialogPrompt: (props: TuiDialogPromptProps<Node>) => Node
    DialogSelect: <Value = unknown>(props: TuiDialogSelectProps<Value, Node>) => Node
    toast: (input: TuiToast) => void
    dialog: TuiDialogStack<Node>
  }
  keybind: {
    parse: (evt: ParsedKey) => TuiKeybind
    match: (key: string, evt: ParsedKey) => boolean
    print: (key: string) => string
    create: (defaults: TuiKeybindMap, overrides?: Record<string, unknown>) => TuiKeybindSet
  }
  theme: TuiTheme
}

export type TuiSlotMap = {
  app: {}
  home_logo: {}
  sidebar_top: {
    session_id: string
  }
}

export type TuiSlotContext = {
  theme: TuiTheme
}

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

export type TuiPluginState = "new" | "changed" | "same"

export type TuiPluginMeta = {
  name: string
  source: "file" | "npm"
  spec: string
  target: string
  requested?: string
  version?: string
  modified?: number
  first_time: number
  last_time: number
  time_changed: number
  load_count: number
  fingerprint: string
}

export type TuiPluginInit = {
  state: TuiPluginState
  first: boolean
  updated: boolean
  entry: TuiPluginMeta
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
  options: PluginOptions | null,
  init: TuiPluginInit,
) => Promise<void>

export type TuiPluginModule<Renderer = CliRenderer, Node = unknown> = {
  server?: ServerPlugin
  tui?: TuiPlugin<Renderer, Node>
  slots?: TuiSlotPlugin
}
