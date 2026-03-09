/** @jsxImportSource @opentui/solid */
import { extend, useKeyboard, useTerminalDimensions, type RenderableConstructor } from "@opentui/solid"
import { RGBA, VignetteEffect, type OptimizedBuffer, type RenderContext } from "@opentui/core"
import { ThreeRenderable, THREE } from "@opentui/core/3d"
import type { TuiApi, TuiKeybindSet, TuiPluginInit, TuiPluginInput } from "@opencode-ai/plugin/tui"

const tabs = ["overview", "counter", "help"]
const bind = {
  modal: "ctrl+shift+m",
  screen: "ctrl+shift+o",
  home: "escape,ctrl+h",
  left: "left,h",
  right: "right,l",
  up: "up,k",
  down: "down,j",
  alert: "a",
  confirm: "c",
  prompt: "p",
  select: "s",
  modal_accept: "enter,return",
  modal_close: "escape",
  dialog_close: "escape",
  local: "x",
  local_push: "enter,return",
  local_close: "q,backspace",
  host: "z",
}

const pick = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback
  if (!value.trim()) return fallback
  return value
}

const num = (value: unknown, fallback: number) => {
  if (typeof value !== "number") return fallback
  return value
}

const rec = (value: unknown) => {
  if (!value || typeof value !== "object") return
  return value as Record<string, unknown>
}

const cfg = (options: Record<string, unknown> | undefined) => {
  return {
    label: pick(options?.label, "smoke"),
    route: pick(options?.route, "workspace-smoke"),
    vignette: Math.max(0, num(options?.vignette, 0.35)),
    keybinds: rec(options?.keybinds),
  }
}

const names = (input: ReturnType<typeof cfg>) => {
  return {
    modal: `${input.route}.modal`,
    screen: `${input.route}.screen`,
  }
}

type Keys = TuiKeybindSet
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
type CubeOpts = ConstructorParameters<typeof ThreeRenderable>[1] & {
  tint?: Color
  spec?: Color
  ambient?: Color
  key_light?: Color
  fill_light?: Color
}

const rgb = (value: unknown, fallback: string) => {
  if (typeof value === "string") return new THREE.Color(value)
  if (value && typeof value === "object") {
    const item = value as { r?: unknown; g?: unknown; b?: unknown }
    if (typeof item.r === "number" && typeof item.g === "number" && typeof item.b === "number") {
      return new THREE.Color(item.r, item.g, item.b)
    }
  }
  return new THREE.Color(fallback)
}

class Cube extends ThreeRenderable {
  private cube: THREE.Mesh
  private mat: THREE.MeshPhongMaterial
  private amb: THREE.AmbientLight
  private key: THREE.DirectionalLight
  private fill: THREE.DirectionalLight

  constructor(ctx: RenderContext, opts: CubeOpts) {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 2.55)

    const amb = new THREE.AmbientLight(rgb(opts.ambient, "#666666"), 1.0)
    scene.add(amb)

    const key = new THREE.DirectionalLight(rgb(opts.key_light, "#fff2e6"), 1.2)
    key.position.set(2.5, 2.0, 3.0)
    scene.add(key)

    const fill = new THREE.DirectionalLight(rgb(opts.fill_light, "#80b3ff"), 0.6)
    fill.position.set(-2.0, -1.5, 2.5)
    scene.add(fill)

    const geo = new THREE.BoxGeometry(1.0, 1.0, 1.0)
    const mat = new THREE.MeshPhongMaterial({
      color: rgb(opts.tint, "#40ccff"),
      shininess: 80,
      specular: rgb(opts.spec, "#e6e6ff"),
    })
    const cube = new THREE.Mesh(geo, mat)
    cube.scale.setScalar(1.12)
    scene.add(cube)

    super(ctx, {
      ...opts,
      scene,
      camera,
      renderer: {
        focalLength: 8,
        alpha: true,
        backgroundColor: RGBA.fromValues(0, 0, 0, 0),
      },
    })

    this.cube = cube
    this.mat = mat
    this.amb = amb
    this.key = key
    this.fill = fill
  }

  set tint(value: Color | undefined) {
    this.mat.color.copy(rgb(value, "#40ccff"))
  }

  set spec(value: Color | undefined) {
    this.mat.specular.copy(rgb(value, "#e6e6ff"))
  }

  set ambient(value: Color | undefined) {
    this.amb.color.copy(rgb(value, "#666666"))
  }

  set key_light(value: Color | undefined) {
    this.key.color.copy(rgb(value, "#fff2e6"))
  }

  set fill_light(value: Color | undefined) {
    this.fill.color.copy(rgb(value, "#80b3ff"))
  }

  protected override renderSelf(buf: OptimizedBuffer, dt: number): void {
    const delta = dt / 1000
    this.cube.rotation.x += delta * 0.6
    this.cube.rotation.y += delta * 0.4
    this.cube.rotation.z += delta * 0.2
    super.renderSelf(buf, dt)
  }
}

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    smoke_cube: RenderableConstructor
  }
}

extend({ smoke_cube: Cube as unknown as RenderableConstructor })

const Btn = (props: { txt: string; run: () => void; skin: Skin; on?: boolean }) => {
  return (
    <box
      onMouseUp={() => {
        props.run()
      }}
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
  const local = typeof params?.local === "number" ? params.local : 0
  return {
    tab: Math.max(0, Math.min(tab, tabs.length - 1)),
    count,
    source,
    note,
    selected,
    local: Math.max(0, local),
  }
}

const current = (api: TuiApi, route: ReturnType<typeof names>) => {
  const value = api.route.current
  const ok = Object.values(route).includes(value.name)
  if (!ok) return parse(undefined)
  if (!("params" in value)) return parse(undefined)
  return parse(value.params)
}

const opts = [
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

const host = (api: TuiApi, input: ReturnType<typeof cfg>, skin: Skin) => {
  api.ui.dialog.setSize("medium")
  api.ui.dialog.replace(() => (
    <box paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1} flexDirection="column">
      <text fg={skin.text}>
        <b>{input.label} host overlay</b>
      </text>
      <text fg={skin.muted}>Using api.ui.dialog stack with built-in backdrop</text>
      <text fg={skin.muted}>esc closes · depth {api.ui.dialog.depth}</text>
      <box flexDirection="row" gap={1}>
        <Btn txt="close" run={() => api.ui.dialog.clear()} skin={skin} on />
      </box>
    </box>
  ))
}

const warn = (api: TuiApi, route: ReturnType<typeof names>, value: ReturnType<typeof parse>) => {
  const DialogAlert = api.ui.DialogAlert
  api.ui.dialog.setSize("medium")
  api.ui.dialog.replace(() => (
    <DialogAlert
      title="Smoke alert"
      message="Testing built-in alert dialog"
      onConfirm={() => api.route.navigate(route.screen, { ...value, source: "alert" })}
    />
  ))
}

const check = (api: TuiApi, route: ReturnType<typeof names>, value: ReturnType<typeof parse>) => {
  const DialogConfirm = api.ui.DialogConfirm
  api.ui.dialog.setSize("medium")
  api.ui.dialog.replace(() => (
    <DialogConfirm
      title="Smoke confirm"
      message="Apply +1 to counter?"
      onConfirm={() => api.route.navigate(route.screen, { ...value, count: value.count + 1, source: "confirm" })}
      onCancel={() => api.route.navigate(route.screen, { ...value, source: "confirm-cancel" })}
    />
  ))
}

const entry = (api: TuiApi, route: ReturnType<typeof names>, value: ReturnType<typeof parse>) => {
  const DialogPrompt = api.ui.DialogPrompt
  api.ui.dialog.setSize("medium")
  api.ui.dialog.replace(() => (
    <DialogPrompt
      title="Smoke prompt"
      value={value.note}
      onConfirm={(note) => {
        api.ui.dialog.clear()
        api.route.navigate(route.screen, { ...value, note, source: "prompt" })
      }}
      onCancel={() => {
        api.ui.dialog.clear()
        api.route.navigate(route.screen, value)
      }}
    />
  ))
}

const picker = (api: TuiApi, route: ReturnType<typeof names>, value: ReturnType<typeof parse>) => {
  const DialogSelect = api.ui.DialogSelect
  api.ui.dialog.setSize("medium")
  api.ui.dialog.replace(() => (
    <DialogSelect
      title="Smoke select"
      options={opts}
      current={value.tab}
      onSelect={(item) => {
        api.ui.dialog.clear()
        api.route.navigate(route.screen, {
          ...value,
          tab: typeof item.value === "number" ? item.value : value.tab,
          selected: item.title,
          source: "select",
        })
      }}
    />
  ))
}

const Screen = (props: {
  api: TuiApi
  input: ReturnType<typeof cfg>
  route: ReturnType<typeof names>
  keys: Keys
  meta: TuiPluginInit
  params?: Record<string, unknown>
}) => {
  const dim = useTerminalDimensions()
  const value = parse(props.params)
  const skin = tone(props.api)
  const set = (local: number, base?: ReturnType<typeof parse>) => {
    const next = base ?? current(props.api, props.route)
    props.api.route.navigate(props.route.screen, { ...next, local: Math.max(0, local), source: "local" })
  }
  const push = (base?: ReturnType<typeof parse>) => {
    const next = base ?? current(props.api, props.route)
    set(next.local + 1, next)
  }
  const open = () => {
    const next = current(props.api, props.route)
    if (next.local > 0) return
    set(1, next)
  }
  const pop = (base?: ReturnType<typeof parse>) => {
    const next = base ?? current(props.api, props.route)
    const local = Math.max(0, next.local - 1)
    set(local, next)
  }
  const show = () => {
    setTimeout(() => {
      open()
    }, 0)
  }
  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.screen) return
    const next = current(props.api, props.route)
    if (props.api.ui.dialog.open) {
      if (props.keys.match("dialog_close", evt)) {
        evt.preventDefault()
        evt.stopPropagation()
        props.api.ui.dialog.clear()
        return
      }
      return
    }

    if (next.local > 0) {
      if (evt.name === "escape" || props.keys.match("local_close", evt)) {
        evt.preventDefault()
        evt.stopPropagation()
        pop(next)
        return
      }

      if (props.keys.match("local_push", evt)) {
        evt.preventDefault()
        evt.stopPropagation()
        push(next)
        return
      }
      return
    }

    if (props.keys.match("home", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate("home")
      return
    }

    if (props.keys.match("left", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, tab: (next.tab - 1 + tabs.length) % tabs.length })
      return
    }

    if (props.keys.match("right", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, tab: (next.tab + 1) % tabs.length })
      return
    }

    if (props.keys.match("up", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, count: next.count + 1 })
      return
    }

    if (props.keys.match("down", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...next, count: next.count - 1 })
      return
    }

    if (props.keys.match("modal", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.modal, next)
      return
    }

    if (props.keys.match("local", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      open()
      return
    }

    if (props.keys.match("host", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      host(props.api, props.input, skin)
      return
    }

    if (props.keys.match("alert", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      warn(props.api, props.route, next)
      return
    }

    if (props.keys.match("confirm", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      check(props.api, props.route, next)
      return
    }

    if (props.keys.match("prompt", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      entry(props.api, props.route, next)
      return
    }

    if (props.keys.match("select", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      picker(props.api, props.route, next)
    }
  })

  return (
    <box width={dim().width} height={dim().height} backgroundColor={skin.panel} position="relative">
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
          <text fg={skin.muted}>{props.keys.print("home")} home</text>
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
              <text fg={skin.muted}>plugin state: {props.meta.state}</text>
              <text fg={skin.muted}>
                first: {props.meta.first ? "yes" : "no"} · updated: {props.meta.updated ? "yes" : "no"} · loads:{" "}
                {props.meta.entry.load_count}
              </text>
              <text fg={skin.muted}>plugin source: {props.meta.entry.source}</text>
              <text fg={skin.muted}>source: {value.source}</text>
              <text fg={skin.muted}>note: {value.note || "(none)"}</text>
              <text fg={skin.muted}>selected: {value.selected || "(none)"}</text>
              <text fg={skin.muted}>local stack depth: {value.local}</text>
              <text fg={skin.muted}>host stack open: {props.api.ui.dialog.open ? "yes" : "no"}</text>
            </box>
          ) : null}

          {value.tab === 1 ? (
            <box flexDirection="column" gap={1}>
              <text fg={skin.text}>Counter: {value.count}</text>
              <text fg={skin.muted}>
                {props.keys.print("up")} / {props.keys.print("down")} change value
              </text>
            </box>
          ) : null}

          {value.tab === 2 ? (
            <box flexDirection="column" gap={1}>
              <text fg={skin.muted}>
                {props.keys.print("modal")} modal | {props.keys.print("alert")} alert | {props.keys.print("confirm")}{" "}
                confirm | {props.keys.print("prompt")} prompt | {props.keys.print("select")} select
              </text>
              <text fg={skin.muted}>
                {props.keys.print("local")} local stack | {props.keys.print("host")} host stack
              </text>
              <text fg={skin.muted}>
                local open: {props.keys.print("local_push")} push nested · esc or {props.keys.print("local_close")}{" "}
                close
              </text>
              <text fg={skin.muted}>{props.keys.print("home")} returns home</text>
            </box>
          ) : null}
        </box>

        <box flexDirection="row" gap={1} paddingTop={1}>
          <Btn txt="go home" run={() => props.api.route.navigate("home")} skin={skin} />
          <Btn txt="modal" run={() => props.api.route.navigate(props.route.modal, value)} skin={skin} on />
          <Btn txt="local overlay" run={show} skin={skin} />
          <Btn txt="host overlay" run={() => host(props.api, props.input, skin)} skin={skin} />
          <Btn txt="alert" run={() => warn(props.api, props.route, value)} skin={skin} />
          <Btn txt="confirm" run={() => check(props.api, props.route, value)} skin={skin} />
          <Btn txt="prompt" run={() => entry(props.api, props.route, value)} skin={skin} />
          <Btn txt="select" run={() => picker(props.api, props.route, value)} skin={skin} />
        </box>
      </box>

      <box
        visible={value.local > 0}
        width={dim().width}
        height={dim().height}
        alignItems="center"
        position="absolute"
        zIndex={3000}
        paddingTop={dim().height / 4}
        left={0}
        top={0}
        backgroundColor={RGBA.fromInts(0, 0, 0, 160)}
        onMouseUp={() => {
          pop()
        }}
      >
        <box
          onMouseUp={(evt) => {
            evt.stopPropagation()
          }}
          width={60}
          maxWidth={dim().width - 2}
          backgroundColor={skin.panel}
          border
          borderColor={skin.border}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          paddingRight={2}
          gap={1}
          flexDirection="column"
        >
          <text fg={skin.text}>
            <b>{props.input.label} local overlay</b>
          </text>
          <text fg={skin.muted}>Plugin-owned stack depth: {value.local}</text>
          <text fg={skin.muted}>
            {props.keys.print("local_push")} push nested · {props.keys.print("local_close")} pop/close
          </text>
          <box flexDirection="row" gap={1}>
            <Btn txt="push" run={push} skin={skin} on />
            <Btn txt="pop" run={pop} skin={skin} />
          </box>
        </box>
      </box>
    </box>
  )
}

const Modal = (props: {
  api: TuiApi
  input: ReturnType<typeof cfg>
  route: ReturnType<typeof names>
  keys: Keys
  params?: Record<string, unknown>
}) => {
  const Dialog = props.api.ui.Dialog
  const value = parse(props.params)
  const skin = tone(props.api)

  useKeyboard((evt) => {
    if (props.api.route.current.name !== props.route.modal) return

    if (props.keys.match("modal_accept", evt)) {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate(props.route.screen, { ...value, source: "modal" })
      return
    }

    if (props.keys.match("modal_close", evt)) {
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
          <text fg={skin.muted}>{props.keys.print("modal")} modal command</text>
          <text fg={skin.muted}>{props.keys.print("screen")} screen command</text>
          <text fg={skin.muted}>
            {props.keys.print("modal_accept")} opens screen · {props.keys.print("modal_close")} closes
          </text>
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
      const map = ctx.theme.current as Record<string, unknown>
      const get = (name: string, fallback: string) => {
        const item = map[name]
        if (typeof item === "string") return item
        if (item && typeof item === "object") return item as RGBA
        return fallback
      }

      return (
        <smoke_cube
          id={`smoke-cube-${value.session_id.slice(0, 8)}`}
          width="100%"
          height={16}
          tint={get("primary", ui.accent)}
          spec={get("text", ui.text)}
          ambient={get("textMuted", ui.muted)}
          key_light={get("success", ui.accent)}
          fill_light={get("info", ui.accent)}
        />
      )
    },
  },
})

const reg = (api: TuiApi, input: ReturnType<typeof cfg>, keys: Keys) => {
  const route = names(input)
  api.command.register(() => [
    {
      title: `${input.label} modal`,
      value: "plugin.smoke.modal",
      keybind: keys.get("modal"),
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
      keybind: keys.get("screen"),
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
        warn(api, route, current(api, route))
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
        check(api, route, current(api, route))
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
        entry(api, route, current(api, route))
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
        picker(api, route, current(api, route))
      },
    },
    {
      title: `${input.label} host overlay`,
      value: "plugin.smoke.host",
      keybind: keys.get("host"),
      category: "Plugin",
      slash: {
        name: "smoke-host",
      },
      onSelect: () => {
        host(api, input, tone(api))
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

const tui = async (input: TuiPluginInput, options: Record<string, unknown> | null, meta: TuiPluginInit) => {
  if (options?.enabled === false) return

  await input.api.theme.install("./smoke-theme.json")
  input.api.theme.set("smoke-theme")

  const value = cfg(options ?? undefined)
  const route = names(value)
  const keys = input.api.keybind.create(bind, value.keybinds)
  const fx = new VignetteEffect(value.vignette)
  input.renderer.addPostProcessFn(fx.apply.bind(fx))

  input.api.route.register([
    {
      name: route.screen,
      render: ({ params }) => (
        <Screen api={input.api} input={value} route={route} keys={keys} meta={meta} params={params} />
      ),
    },
    {
      name: route.modal,
      render: ({ params }) => <Modal api={input.api} input={value} route={route} keys={keys} params={params} />,
    },
  ])

  reg(input.api, value, keys)
  input.slots.register(slot(value))
}

export default {
  tui,
}
