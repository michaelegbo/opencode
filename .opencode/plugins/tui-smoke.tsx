/** @jsxImportSource @opentui/solid */
import mytheme from "../themes/mytheme.json" with { type: "json" }
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { TuiApi, TuiPluginInput } from "@opencode-ai/plugin/tui"

const tabs = ["overview", "counter", "help"]

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

const parse = (data: Record<string, unknown> | undefined) => {
  const tab = typeof data?.tab === "number" ? data.tab : 0
  const count = typeof data?.count === "number" ? data.count : 0
  const source = typeof data?.source === "string" ? data.source : "unknown"
  return {
    tab,
    count,
    source,
  }
}

const active = (api: TuiApi, id: string) => {
  const route = api.route.data
  return route.type === "plugin" && route.id === id
}

const merge = (api: TuiApi, patch: Record<string, unknown>) => {
  const route = api.route.data
  if (route.type !== "plugin") return patch
  return { ...(route.data ?? {}), ...patch }
}

const open = (api: TuiApi, input: ReturnType<typeof cfg>, source: string) => {
  console.log("[smoke] open", { route: input.route, source })
  api.route.plugin(input.route, merge(api, { source }))
  api.dialog.clear()
}

const patch = (api: TuiApi, input: ReturnType<typeof cfg>, value: Record<string, unknown>) => {
  api.route.plugin(input.route, merge(api, value))
}

const Modal = (props: { api: TuiApi; input: ReturnType<typeof cfg> }) => {
  useKeyboard((evt) => {
    if (evt.defaultPrevented) return
    if (evt.name !== "return") return

    console.log("[smoke] modal key", { key: evt.name })
    evt.preventDefault()
    evt.stopPropagation()
    open(props.api, props.input, "modal")
  })

  return (
    <box paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1} flexDirection="column">
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
        <box onMouseUp={() => props.api.dialog.clear()} backgroundColor={ui.border} paddingLeft={1} paddingRight={1}>
          <text fg={ui.text}>cancel</text>
        </box>
      </box>
    </box>
  )
}

const Screen = (props: { api: TuiApi; input: ReturnType<typeof cfg>; data?: Record<string, unknown> }) => {
  const dim = useTerminalDimensions()
  const value = parse(props.data)

  useKeyboard((evt) => {
    if (evt.defaultPrevented) return
    if (!active(props.api, props.input.route)) return

    const state = parse(props.api.route.data.type === "plugin" ? props.api.route.data.data : undefined)

    if (evt.name === "escape" || (evt.ctrl && evt.name === "h")) {
      console.log("[smoke] screen key", { key: evt.name, ctrl: evt.ctrl })
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.home()
      return
    }

    if (evt.name === "left") {
      console.log("[smoke] screen key", { key: evt.name })
      evt.preventDefault()
      evt.stopPropagation()
      patch(props.api, props.input, { tab: (state.tab - 1 + tabs.length) % tabs.length })
      return
    }

    if (evt.name === "right") {
      console.log("[smoke] screen key", { key: evt.name })
      evt.preventDefault()
      evt.stopPropagation()
      patch(props.api, props.input, { tab: (state.tab + 1) % tabs.length })
      return
    }

    if (evt.name === "up" || (evt.ctrl && evt.name === "up")) {
      console.log("[smoke] screen key", { key: evt.name, ctrl: evt.ctrl })
      evt.preventDefault()
      evt.stopPropagation()
      patch(props.api, props.input, { count: state.count + 1 })
      return
    }

    if (evt.name === "down" || (evt.ctrl && evt.name === "down")) {
      console.log("[smoke] screen key", { key: evt.name, ctrl: evt.ctrl })
      evt.preventDefault()
      evt.stopPropagation()
      patch(props.api, props.input, { count: state.count - 1 })
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
      >
        <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
          <text fg={ui.text}>
            <b>{props.input.label} screen</b>
            <span style={{ fg: ui.muted }}> plugin route</span>
          </text>
          <text fg={ui.muted}>esc or ctrl+h home</text>
        </box>

        <box flexDirection="row" gap={1} paddingBottom={1}>
          {tabs.map((item, i) => {
            const on = value.tab === i
            return (
              <box
                onMouseUp={() => patch(props.api, props.input, { tab: i })}
                backgroundColor={on ? ui.accent : ui.border}
                paddingLeft={1}
                paddingRight={1}
              >
                <text fg={ui.text}>{item}</text>
              </box>
            )
          })}
        </box>

        <box
          border
          borderColor={ui.border}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
          flexGrow={1}
        >
          {value.tab === 0 ? (
            <box flexDirection="column" gap={1}>
              <text fg={ui.text}>Route id: {props.input.route}</text>
              <text fg={ui.muted}>source: {value.source}</text>
              <text fg={ui.muted}>left/right switch tabs</text>
            </box>
          ) : null}

          {value.tab === 1 ? (
            <box flexDirection="column" gap={1}>
              <text fg={ui.text}>Counter: {value.count}</text>
              <text fg={ui.muted}>ctrl+up and ctrl+down change value</text>
              <box flexDirection="row" gap={1}>
                <box
                  onMouseUp={() => patch(props.api, props.input, { count: value.count + 1 })}
                  backgroundColor={ui.border}
                  paddingLeft={1}
                >
                  <text fg={ui.text}>+1</text>
                </box>
                <box
                  onMouseUp={() => patch(props.api, props.input, { count: value.count - 1 })}
                  backgroundColor={ui.border}
                  paddingLeft={1}
                >
                  <text fg={ui.text}>-1</text>
                </box>
              </box>
            </box>
          ) : null}

          {value.tab === 2 ? (
            <box flexDirection="column" gap={1}>
              <text fg={ui.muted}>ctrl+m opens modal</text>
              <text fg={ui.muted}>esc or ctrl+h returns home</text>
            </box>
          ) : null}
        </box>

        <box flexDirection="row" gap={1} paddingTop={1}>
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
