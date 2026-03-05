/** @jsxImportSource @opentui/solid */
import mytheme from "../themes/mytheme.json" with { type: "json" }
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { VignetteEffect, type RGBA } from "@opentui/core"
import type { TuiApi, TuiPluginInput } from "@opencode-ai/plugin/tui"

const tabs = ["overview", "counter", "help"]

const pick = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback
  if (!value.trim()) return fallback
  return value
}

const num = (value: unknown, fallback: number) => {
  if (typeof value !== "number") return fallback
  return value
}

const cfg = (options: Record<string, unknown> | undefined) => {
  return {
    label: pick(options?.label, "smoke"),
    modal: pick(options?.modal, "ctrl+shift+m"),
    screen: pick(options?.screen, "ctrl+shift+o"),
    route: pick(options?.route, "workspace-smoke"),
    vignette: Math.max(0, num(options?.vignette, 0.35)),
  }
}

const names = (input: ReturnType<typeof cfg>) => {
  return {
    modal: `${input.route}.modal`,
    screen: `${input.route}.screen`,
    alert: `${input.route}.alert`,
    confirm: `${input.route}.confirm`,
    prompt: `${input.route}.prompt`,
    select: `${input.route}.select`,
  }
}

const ui = {
  panel: "#1d1d1d",
  border: "#4a4a4a",
  text: "#f0f0f0",
  muted: "#a5a5a5",
  accent: "#5f87ff",
}

type Color = RGBA | string

const tone = (api: TuiApi) => {
  const map = api.theme.current as Record<string, unknown>
  const get = (name: string, fallback: string): Color => {
    const value = map[name]
    if (typeof value === "string") return value
    if (value && typeof value === "object") return value as RGBA
    return fallback
  }
  return {
    panel: get("backgroundPanel", ui.panel),
    border: get("border", ui.border),
    text: get("text", ui.text),
    muted: get("textMuted", ui.muted),
    accent: get("primary", ui.accent),
    selected: get("selectedListItemText", ui.text),
  }
}

type Skin = ReturnType<typeof tone>

const Btn = (props: { txt: string; run: () => void; skin: Skin; on?: boolean }) => {
  return (
    <box
      onMouseUp={props.run}
      backgroundColor={props.on ? props.skin.accent : props.skin.border}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={props.on ? props.skin.selected : props.skin.text}>{props.txt}</text>
    </box>
  )
}

const parse = (params: Record<string, unknown> | undefined) => {
  const tab = typeof params?.tab === "number" ? params.tab : 0
  const count = typeof params?.count === "number" ? params.count : 0
  const source = typeof params?.source === "string" ? params.source : "unknown"
  const note = typeof params?.note === "string" ? params.note : ""
  const selected = typeof params?.selected === "string" ? params.selected : ""
  return {
    tab: Math.max(0, Math.min(tab, tabs.length - 1)),
    count,
    source,
    note,
    selected,
  }
}

const current = (api: TuiApi, route: ReturnType<typeof names>) => {
  const value = api.route.current
  const ok = Object.values(route).includes(value.name)
  if (!ok) return parse(undefined)
  if (!("params" in value)) return parse(undefined)
  return parse(value.params)
}

const Screen = (props: {
  api: TuiApi
  input: ReturnType<typeof cfg>
  route: ReturnType<typeof names>
  params?: Record<string, unknown>
}) => {
  const dim = useTerminalDimensions()
  const value = parse(props.params)
  const skin = tone(props.api)

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.screen) return

    const next = current(props.api, props.route)

    if (evt.name === "escape" || (evt.ctrl && evt.name === "h")) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate("home")
      return
    }

    if (evt.name === "left" || evt.name === "h") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, tab: (next.tab - 1 + tabs.length) % tabs.length })
      return
    }

    if (evt.name === "right" || evt.name === "l") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, tab: (next.tab + 1) % tabs.length })
      return
    }

    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, count: next.count + 1 })
      return
    }

    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, count: next.count - 1 })
      return
    }

    if (evt.ctrl && evt.name === "m") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.modal, next)
      return
    }

    if (evt.name === "a") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.alert, next)
      return
    }

    if (evt.name === "c") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.confirm, next)
      return
    }

    if (evt.name === "p") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.prompt, next)
      return
    }

    if (evt.name === "s") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.select, next)
    }
  })

  return (
    <box width={dim().width} height={dim().height} backgroundColor={skin.panel}>
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
          <text fg={skin.text}>
            <b>{props.input.label} screen</b>
            <span style={{ fg: skin.muted }}> plugin route</span>
          </text>
          <text fg={skin.muted}>esc or ctrl+h home</text>
        </box>

        <box flexDirection="row" gap={1} paddingBottom={1}>
          {tabs.map((item, i) => {
            const on = value.tab === i
            return (
              <Btn
                txt={item}
                run={() => props.api.route.navigate(props.route.screen, { ...value, tab: i })}
                skin={skin}
                on={on}
              />
            )
          })}
        </box>

        <box
          border
          borderColor={skin.border}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
          flexGrow={1}
        >
          {value.tab === 0 ? (
            <box flexDirection="column" gap={1}>
              <text fg={skin.text}>Route: {props.route.screen}</text>
              <text fg={skin.muted}>source: {value.source}</text>
              <text fg={skin.muted}>note: {value.note || "(none)"}</text>
              <text fg={skin.muted}>selected: {value.selected || "(none)"}</text>
            </box>
          ) : null}

          {value.tab === 1 ? (
            <box flexDirection="column" gap={1}>
              <text fg={skin.text}>Counter: {value.count}</text>
              <text fg={skin.muted}>up/down or j/k change value</text>
            </box>
          ) : null}

          {value.tab === 2 ? (
            <box flexDirection="column" gap={1}>
              <text fg={skin.muted}>ctrl+m modal | a alert | c confirm | p prompt | s select</text>
              <text fg={skin.muted}>esc or ctrl+h returns home</text>
            </box>
          ) : null}
        </box>

        <box flexDirection="row" gap={1} paddingTop={1}>
          <Btn txt="go home" run={() => props.api.route.navigate("home")} skin={skin} />
          <Btn txt="modal" run={() => props.api.route.navigate(props.route.modal, value)} skin={skin} on />
          <Btn txt="alert" run={() => props.api.route.navigate(props.route.alert, value)} skin={skin} />
          <Btn txt="confirm" run={() => props.api.route.navigate(props.route.confirm, value)} skin={skin} />
          <Btn txt="prompt" run={() => props.api.route.navigate(props.route.prompt, value)} skin={skin} />
          <Btn txt="select" run={() => props.api.route.navigate(props.route.select, value)} skin={skin} />
        </box>
      </box>
    </box>
  )
}

const Modal = (props: {
  api: TuiApi
  input: ReturnType<typeof cfg>
  route: ReturnType<typeof names>
  params?: Record<string, unknown>
}) => {
  const Dialog = props.api.ui.Dialog
  const value = parse(props.params)
  const skin = tone(props.api)

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.modal) return

    if (evt.name === "return" || evt.name === "enter") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...value, source: "modal" })
      return
    }

    if (evt.name === "escape") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate("home")
    }
  })

  return (
    <box width="100%" height="100%" backgroundColor={skin.panel}>
      <Dialog onClose={() => props.api.route.navigate("home")}>
        <box paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1} flexDirection="column">
          <text fg={skin.text}>
            <b>{props.input.label} modal</b>
          </text>
          <text fg={skin.muted}>{props.api.keybind.print(props.input.modal)} modal command</text>
          <text fg={skin.muted}>{props.api.keybind.print(props.input.screen)} screen command</text>
          <text fg={skin.muted}>enter opens screen · esc closes</text>
          <box flexDirection="row" gap={1}>
            <Btn
              txt="open screen"
              run={() => props.api.route.navigate(props.route.screen, { ...value, source: "modal" })}
              skin={skin}
              on
            />
            <Btn txt="cancel" run={() => props.api.route.navigate("home")} skin={skin} />
          </box>
        </box>
      </Dialog>
    </box>
  )
}

const AlertDialog = (props: { api: TuiApi; route: ReturnType<typeof names>; params?: Record<string, unknown> }) => {
  const Dialog = props.api.ui.Dialog
  const DialogAlert = props.api.ui.DialogAlert
  const value = parse(props.params)

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.alert) return
    if (evt.name !== "escape") return
    evt.preventDefault()
    evt.stopPropagation()
    props.api.route.navigate(props.route.screen, value)
  })

  return (
    <box width="100%" height="100%" backgroundColor={ui.panel}>
      <Dialog onClose={() => props.api.route.navigate(props.route.screen, value)}>
        <DialogAlert
          title="Smoke alert"
          message="Testing built-in alert dialog"
          onConfirm={() => props.api.route.navigate(props.route.screen, { ...value, source: "alert" })}
        />
      </Dialog>
    </box>
  )
}

const ConfirmDialog = (props: { api: TuiApi; route: ReturnType<typeof names>; params?: Record<string, unknown> }) => {
  const Dialog = props.api.ui.Dialog
  const DialogConfirm = props.api.ui.DialogConfirm
  const value = parse(props.params)

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.confirm) return
    if (evt.name !== "escape") return
    evt.preventDefault()
    evt.stopPropagation()
    props.api.route.navigate(props.route.screen, value)
  })

  return (
    <box width="100%" height="100%" backgroundColor={ui.panel}>
      <Dialog onClose={() => props.api.route.navigate(props.route.screen, value)}>
        <DialogConfirm
          title="Smoke confirm"
          message="Apply +1 to counter?"
          onConfirm={() =>
            props.api.route.navigate(props.route.screen, { ...value, count: value.count + 1, source: "confirm" })
          }
          onCancel={() => props.api.route.navigate(props.route.screen, { ...value, source: "confirm-cancel" })}
        />
      </Dialog>
    </box>
  )
}

const PromptDialog = (props: { api: TuiApi; route: ReturnType<typeof names>; params?: Record<string, unknown> }) => {
  const Dialog = props.api.ui.Dialog
  const DialogPrompt = props.api.ui.DialogPrompt
  const value = parse(props.params)

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.prompt) return
    if (evt.name !== "escape") return
    evt.preventDefault()
    evt.stopPropagation()
    props.api.route.navigate(props.route.screen, value)
  })

  return (
    <box width="100%" height="100%" backgroundColor={ui.panel}>
      <Dialog onClose={() => props.api.route.navigate(props.route.screen, value)}>
        <DialogPrompt
          title="Smoke prompt"
          description={() => <text fg={ui.muted}>Enter a note to store in route params</text>}
          value={value.note}
          onConfirm={(note) => props.api.route.navigate(props.route.screen, { ...value, note, source: "prompt" })}
          onCancel={() => props.api.route.navigate(props.route.screen, value)}
        />
      </Dialog>
    </box>
  )
}

const SelectDialog = (props: { api: TuiApi; route: ReturnType<typeof names>; params?: Record<string, unknown> }) => {
  const Dialog = props.api.ui.Dialog
  const DialogSelect = props.api.ui.DialogSelect
  const value = parse(props.params)
  const options = [
    {
      title: "Overview",
      value: 0,
      description: "Switch to overview tab",
    },
    {
      title: "Counter",
      value: 1,
      description: "Switch to counter tab",
    },
    {
      title: "Help",
      value: 2,
      description: "Switch to help tab",
    },
  ]

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.select) return
    if (evt.name !== "escape") return
    evt.preventDefault()
    evt.stopPropagation()
    props.api.route.navigate(props.route.screen, value)
  })

  return (
    <box width="100%" height="100%" backgroundColor={ui.panel}>
      <Dialog onClose={() => props.api.route.navigate(props.route.screen, value)}>
        <DialogSelect
          title="Smoke select"
          options={options}
          current={value.tab}
          onSelect={(item) =>
            props.api.route.navigate(props.route.screen, {
              ...value,
              tab: typeof item.value === "number" ? item.value : value.tab,
              selected: item.title,
              source: "select",
            })
          }
        />
      </Dialog>
    </box>
  )
}

const slot = (input: ReturnType<typeof cfg>) => ({
  id: "workspace-smoke",
  slots: {
    home_logo(ctx) {
      const map = ctx.theme.current as Record<string, unknown>
      const get = (name: string, fallback: string) => {
        const value = map[name]
        if (typeof value === "string") return value
        if (value && typeof value === "object") return value as RGBA
        return fallback
      }
      const art = [
        "                                  $$\\",
        "                                  $$ |",
        " $$$$$$$\\ $$$$$$\\$$$$\\   $$$$$$\\  $$ |  $$\\  $$$$$$\\",
        "$$  _____|$$  _$$  _$$\\ $$  __$$\\ $$ | $$  |$$  __$$\\",
        "\\$$$$$$\\  $$ / $$ / $$ |$$ /  $$ |$$$$$$  / $$$$$$$$ |",
        " \\____$$\\ $$ | $$ | $$ |$$ |  $$ |$$  _$$<  $$   ____|",
        "$$$$$$$  |$$ | $$ | $$ |\\$$$$$$  |$$ | \\$$\\ \\$$$$$$$\\",
        "\\_______/ \\__| \\__| \\__| \\______/ \\__|  \\__| \\_______|",
      ]
      const ink = [
        get("primary", ui.accent),
        get("textMuted", ui.muted),
        get("info", ui.accent),
        get("text", ui.text),
        get("success", ui.accent),
        get("warning", ui.accent),
        get("secondary", ui.accent),
        get("error", ui.accent),
      ]

      return (
        <box flexDirection="column">
          {art.map((line, i) => (
            <text fg={ink[i]}>{line}</text>
          ))}
        </box>
      )
    },
    sidebar_top(ctx, value) {
      return (
        <text>
          plugin:{input.label} session:{value.session_id.slice(0, 8)} ready:{String(ctx.theme.ready)}
        </text>
      )
    },
  },
})

const reg = (api: TuiApi, input: ReturnType<typeof cfg>) => {
  const route = names(input)
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
        api.route.navigate(route.modal, { source: "command" })
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
        api.route.navigate(route.screen, { source: "command", tab: 0, count: 0 })
      },
    },
    {
      title: `${input.label} alert dialog`,
      value: "plugin.smoke.alert",
      category: "Plugin",
      slash: {
        name: "smoke-alert",
      },
      onSelect: () => {
        api.route.navigate(route.alert, current(api, route))
      },
    },
    {
      title: `${input.label} confirm dialog`,
      value: "plugin.smoke.confirm",
      category: "Plugin",
      slash: {
        name: "smoke-confirm",
      },
      onSelect: () => {
        api.route.navigate(route.confirm, current(api, route))
      },
    },
    {
      title: `${input.label} prompt dialog`,
      value: "plugin.smoke.prompt",
      category: "Plugin",
      slash: {
        name: "smoke-prompt",
      },
      onSelect: () => {
        api.route.navigate(route.prompt, current(api, route))
      },
    },
    {
      title: `${input.label} select dialog`,
      value: "plugin.smoke.select",
      category: "Plugin",
      slash: {
        name: "smoke-select",
      },
      onSelect: () => {
        api.route.navigate(route.select, current(api, route))
      },
    },
    {
      title: `${input.label} go home`,
      value: "plugin.smoke.home",
      category: "Plugin",
      enabled: api.route.current.name !== "home",
      onSelect: () => {
        api.route.navigate("home")
      },
    },
    {
      title: `${input.label} toast`,
      value: "plugin.smoke.toast",
      category: "Plugin",
      onSelect: () => {
        api.ui.toast({
          variant: "info",
          title: "Smoke",
          message: "Plugin toast works",
          duration: 2000,
        })
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
  const route = names(value)
  const fx = new VignetteEffect(value.vignette)
  input.renderer.addPostProcessFn(fx.apply.bind(fx))

  input.api.route.register([
    {
      name: route.screen,
      render: ({ params }) => <Screen api={input.api} input={value} route={route} params={params} />,
    },
    {
      name: route.modal,
      render: ({ params }) => <Modal api={input.api} input={value} route={route} params={params} />,
    },
    {
      name: route.alert,
      render: ({ params }) => <AlertDialog api={input.api} route={route} params={params} />,
    },
    {
      name: route.confirm,
      render: ({ params }) => <ConfirmDialog api={input.api} route={route} params={params} />,
    },
    {
      name: route.prompt,
      render: ({ params }) => <PromptDialog api={input.api} route={route} params={params} />,
    },
    {
      name: route.select,
      render: ({ params }) => <SelectDialog api={input.api} route={route} params={params} />,
    },
  ])

  reg(input.api, value)
  input.slots.register(slot(value))
}

export default {
  themes,
  tui,
}
