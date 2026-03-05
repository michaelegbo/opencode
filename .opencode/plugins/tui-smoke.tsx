/** @jsxImportSource @opentui/solid */
import mytheme from "../themes/mytheme.json" with { type: "json" }
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { TuiApi, TuiPluginInput } from "@opencode-ai/plugin/tui"

const pick = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback
  if (!value.trim()) return fallback
  return value
}

const cfg = (options: Record<string, unknown> | undefined) => {
  return {
    label: pick(options?.label, "smoke"),
    modal: pick(options?.modal, "ctrl+shift+m"),
    screen: pick(options?.screen, "ctrl+shift+o"),
    route: pick(options?.route, "workspace-smoke"),
  }
}

const ui = {
  panel: "#1d1d1d",
  border: "#4a4a4a",
  text: "#f0f0f0",
  muted: "#a5a5a5",
  accent: "#5f87ff",
}

const active = (api: TuiApi, id: string) => {
  const route = api.route.data
  return route.type === "plugin" && route.id === id
}

const open = (api: TuiApi, input: ReturnType<typeof cfg>, source: string) => {
  console.log("[smoke] open", { route: input.route, source })
  api.route.plugin(input.route, { source })
  api.dialog.clear()
}

const Modal = (props: { api: TuiApi; input: ReturnType<typeof cfg> }) => {
  const dim = useTerminalDimensions()

  useKeyboard((evt) => {
    if (evt.defaultPrevented) return
    if (evt.name !== "return") return

    console.log("[smoke] modal key", { key: evt.name })
    evt.preventDefault()
    evt.stopPropagation()
    open(props.api, props.input, "modal")
  })

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width={dim().width}
      height={dim().height}
      alignItems="center"
      paddingTop={Math.max(3, Math.floor(dim().height / 4))}
      backgroundColor="#000000"
    >
      <box width={64} maxWidth={dim().width - 4} backgroundColor={ui.panel} border borderColor={ui.border}>
        <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1}>
          <text fg={ui.text}>
            <b>{props.input.label} modal</b>
          </text>
          <text fg={ui.muted}>Plugin commands and keybinds work without host internals</text>
          <text fg={ui.muted}>
            {props.api.keybind.print(props.input.modal)} open modal · {props.api.keybind.print(props.input.screen)} open
            screen
          </text>
          <text fg={ui.muted}>enter opens screen · esc closes</text>
          <box flexDirection="row" gap={1}>
            <box
              onMouseUp={() => open(props.api, props.input, "modal")}
              backgroundColor={ui.accent}
              paddingLeft={1}
              paddingRight={1}
            >
              <text fg={ui.text}>open screen</text>
            </box>
            <box
              onMouseUp={() => props.api.dialog.clear()}
              backgroundColor={ui.border}
              paddingLeft={1}
              paddingRight={1}
            >
              <text fg={ui.text}>cancel</text>
            </box>
          </box>
        </box>
      </box>
    </box>
  )
}

const Screen = (props: { api: TuiApi; input: ReturnType<typeof cfg>; data?: Record<string, unknown> }) => {
  const dim = useTerminalDimensions()

  useKeyboard((evt) => {
    if (evt.defaultPrevented) return
    if (evt.name === "escape" || (evt.ctrl && evt.name === "h")) {
      console.log("[smoke] screen key", { key: evt.name, ctrl: evt.ctrl })
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.home()
      return
    }

    if (evt.ctrl && evt.name === "m") {
      console.log("[smoke] screen key", { key: evt.name, ctrl: evt.ctrl })
      evt.preventDefault()
      evt.stopPropagation()
      props.api.dialog.replace(() => <Modal api={props.api} input={props.input} />)
    }
  })

  return (
    <box width={dim().width} height={dim().height} backgroundColor={ui.panel}>
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
        gap={1}
      >
        <text fg={ui.text}>
          <b>{props.input.label} screen</b>
          <span style={{ fg: ui.muted }}> plugin route</span>
        </text>
        <text fg={ui.text}>Route id: {props.input.route}</text>
        <text fg={ui.muted}>source: {String(props.data?.source ?? "unknown")}</text>
        <text fg={ui.muted}>esc or ctrl+h go home · ctrl+m opens modal</text>
        <box flexDirection="row" gap={1}>
          <box onMouseUp={() => props.api.route.home()} backgroundColor={ui.border} paddingLeft={1} paddingRight={1}>
            <text fg={ui.text}>go home</text>
          </box>
          <box
            onMouseUp={() => props.api.dialog.replace(() => <Modal api={props.api} input={props.input} />)}
            backgroundColor={ui.accent}
            paddingLeft={1}
            paddingRight={1}
          >
            <text fg={ui.text}>open modal</text>
          </box>
        </box>
      </box>
    </box>
  )
}

const slot = (api: TuiApi, input: ReturnType<typeof cfg>) => ({
  id: "workspace-smoke",
  slots: {
    route(_ctx, value) {
      if (value.route_id !== input.route) return null
      console.log("[smoke] route render", { route: value.route_id, data: value.data })
      return <Screen api={api} input={input} data={value.data} />
    },
    home_logo() {
      return <text>plugin logo:{input.label}</text>
    },
    sidebar_top(_ctx, value) {
      return (
        <text>
          plugin:{input.label} session:{value.session_id.slice(0, 8)}
        </text>
      )
    },
  },
})

const reg = (api: TuiApi, input: ReturnType<typeof cfg>) => {
  api.command.register(() => [
    {
      title: `${input.label} modal`,
      value: "plugin.smoke.modal",
      keybind: input.modal,
      category: "Plugin",
      slash: {
        name: "smoke",
      },
      onSelect: () => {
        console.log("[smoke] command", { value: "plugin.smoke.modal" })
        api.dialog.replace(() => <Modal api={api} input={input} />)
      },
    },
    {
      title: `${input.label} screen`,
      value: "plugin.smoke.screen",
      keybind: input.screen,
      category: "Plugin",
      slash: {
        name: "smoke-screen",
      },
      onSelect: () => {
        console.log("[smoke] command", { value: "plugin.smoke.screen" })
        open(api, input, "command")
      },
    },
    {
      title: `${input.label} go home`,
      value: "plugin.smoke.home",
      category: "Plugin",
      enabled: active(api, input.route),
      onSelect: () => {
        console.log("[smoke] command", { value: "plugin.smoke.home" })
        api.route.home()
        api.dialog.clear()
      },
    },
  ])
}

const themes = {
  "workspace-plugin-smoke": mytheme,
}

const tui = async (input: TuiPluginInput, options?: Record<string, unknown>) => {
  if (options?.enabled === false) return

  const value = cfg(options)
  console.log("[smoke] init", {
    label: value.label,
    modal: value.modal,
    screen: value.screen,
    route: value.route,
  })
  reg(input.api, value)
  input.slots.register(slot(input.api, value))
}

export default {
  themes,
  tui,
}
