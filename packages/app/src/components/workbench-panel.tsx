import { createEffect, createMemo, For, on, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useParams } from "@solidjs/router"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { Button } from "@opencode-ai/ui/button"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { showToast } from "@opencode-ai/ui/toast"
import { WorkbenchEditor } from "@/components/workbench-editor"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useTerminal } from "@/context/terminal"
import { previewFromSession, previewFromTerminals } from "@/utils/preview-url"

type Node = {
  name: string
  path: string
  dir: boolean
  file: boolean
}

type Tab = {
  name: string
  path: string
  value: string
  saved: string
  dirty: boolean
}

type Mode = "code" | "split" | "preview"

const base = (path: string) => {
  const trim = path.replace(/[\\/]+$/, "")
  const parts = trim.split(/[\\/]/)
  return parts.at(-1) ?? trim
}

const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

const pickDoc = (url: string, html: string) => {
  const css = `<style>
html.__paddie_pick, html.__paddie_pick * { cursor: crosshair !important; }
.__paddie_pick_target { outline: 2px solid #60a5fa !important; outline-offset: 2px !important; }
</style>`
  const js = `<script>
(() => {
  const esc = window.CSS && CSS.escape ? CSS.escape.bind(CSS) : (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&")
  const ok = (el) => el instanceof Element && !["HTML", "BODY", "SCRIPT", "STYLE", "LINK", "META"].includes(el.tagName)
  const nth = (el) => {
    const parent = el.parentElement
    if (!parent) return ""
    const kids = Array.from(parent.children).filter((item) => item.tagName === el.tagName)
    if (kids.length <= 1) return ""
    return ":nth-of-type(" + (kids.indexOf(el) + 1) + ")"
  }
  const cls = (el) => {
    const list = Array.from(el.classList).slice(0, 2)
    if (list.length === 0) return ""
    return list.map((item) => "." + esc(item)).join("")
  }
  const line = (el) => {
    let out = el.tagName.toLowerCase()
    if (el.id) out += "#" + el.id
    const list = Array.from(el.classList).slice(0, 2)
    if (list.length) out += "." + list.join(".")
    return out
  }
  const path = (el) => {
    const out = []
    let cur = el
    while (ok(cur)) {
      let item = cur.tagName.toLowerCase()
      if (cur.id) {
        out.unshift(item + "#" + esc(cur.id))
        break
      }
      item += cls(cur) + nth(cur)
      out.unshift(item)
      cur = cur.parentElement
    }
    return out.join(" > ")
  }
  const text = (el) => (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240)
  let last
  const mark = (el) => {
    if (last === el) return
    if (last) last.classList.remove("__paddie_pick_target")
    last = el
    if (el) el.classList.add("__paddie_pick_target")
  }
  const post = (type, payload = {}) => parent.postMessage({ source: "paddie-studio-preview", type, payload }, "*")
  const find = (target) => {
    if (!(target instanceof Element)) return
    const hit = target.closest("*")
    if (!ok(hit)) return
    return hit
  }
  document.documentElement.classList.add("__paddie_pick")
  document.addEventListener("mousemove", (event) => {
    const hit = find(event.target)
    if (!hit) return
    mark(hit)
  }, true)
  document.addEventListener("click", (event) => {
    const hit = find(event.target)
    if (!hit) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    post("pick", {
      url: ${JSON.stringify(url)},
      selector: path(hit),
      label: line(hit),
      text: text(hit) || undefined,
      html: (hit.outerHTML || "").replace(/\\s+/g, " ").trim().slice(0, 4000),
    })
  }, true)
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return
    event.preventDefault()
    event.stopPropagation()
    post("cancel")
  }, true)
  post("ready")
})()
</script>`

  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1><base href="${esc(url)}">${css}${js}`)
  }

  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head><base href="${esc(url)}">${css}${js}</head>`)
  }

  return `<!doctype html><html><head><base href="${esc(url)}">${css}${js}</head><body>${html}</body></html>`
}

function Tree(props: {
  path: string
  level: number
  active: () => string
  load: (path: string, force?: boolean) => Promise<void>
  open: (path: string) => boolean
  wait: (path: string) => boolean
  tree: () => Record<string, Node[]>
  toggle: (path: string) => void
  file: (path: string) => Promise<void>
}) {
  const kids = createMemo(() => props.tree()[props.path] ?? [])
  const name = createMemo(() => base(props.path) || props.path)

  return (
    <div class="min-w-0">
      <button
        type="button"
        class="w-full h-7 px-2 rounded-md flex items-center gap-1.5 text-left hover:bg-surface-base-hover"
        style={{ "padding-left": `${8 + props.level * 12}px` }}
        onClick={() => {
          props.toggle(props.path)
          if (!props.tree()[props.path]) void props.load(props.path)
        }}
      >
        <Icon size="small" name={props.open(props.path) ? "chevron-down" : "chevron-right"} class="text-icon-base" />
        <FileIcon node={{ path: props.path, type: "directory" }} expanded={props.open(props.path)} class="size-4" />
        <span class="min-w-0 flex-1 truncate text-12-medium text-text-base">{name()}</span>
      </button>

      <Show when={props.open(props.path)}>
        <Show when={props.wait(props.path) && kids().length === 0}>
          <div class="px-3 py-2 text-11-medium text-text-weak" style={{ "padding-left": `${34 + props.level * 12}px` }}>
            Loading...
          </div>
        </Show>
        <For each={kids()}>
          {(item) => (
            <Show
              when={item.dir}
              fallback={
                <button
                  type="button"
                  classList={{
                    "w-full h-7 px-2 rounded-md flex items-center gap-1.5 text-left hover:bg-surface-base-hover": true,
                    "bg-surface-base-active": props.active() === item.path,
                  }}
                  style={{ "padding-left": `${32 + props.level * 12}px` }}
                  onClick={() => void props.file(item.path)}
                >
                  <div class="size-3.5 shrink-0" />
                  <FileIcon node={{ path: item.path, type: "file" }} class="size-4" />
                  <span class="min-w-0 flex-1 truncate text-12-medium text-text-base">{item.name}</span>
                </button>
              }
            >
              <Tree
                path={item.path}
                level={props.level + 1}
                active={props.active}
                load={props.load}
                open={props.open}
                wait={props.wait}
                tree={props.tree}
                toggle={props.toggle}
                file={props.file}
              />
            </Show>
          )}
        </For>
      </Show>
    </div>
  )
}

export function WorkbenchPanel(props: {
  chatHidden?: boolean
  onChatToggle?: VoidFunction
  onClose?: VoidFunction
}) {
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()
  const prompt = usePrompt()
  const params = useParams()
  const sdk = useSDK()
  const sync = useSync()
  const terminal = useTerminal()
  const api = () => platform.workbench
  const root = createMemo(() => sync.data.path.directory || sdk.directory)
  const [state, setState] = createStore({
    files: true,
    left: 280,
    right: 420,
    box: 0,
    mode: "split" as Mode,
    tree: {} as Record<string, Node[]>,
    wait: {} as Record<string, boolean>,
    open: {} as Record<string, boolean>,
    tabs: [] as Tab[],
    active: "",
    url: "",
    pick: false,
    doc: "",
    waitPick: false,
  })

  let wrap: HTMLDivElement | undefined
  let frame: HTMLIFrameElement | undefined
  let stop: VoidFunction | undefined
  let tick: number | undefined

  const tab = createMemo(() => state.tabs.find((item) => item.path === state.active))
  const messages = createMemo(() => (params.id ? (sync.data.message[params.id] ?? []) : []))
  const detected = createMemo(
    () => previewFromSession(messages(), sync.data.part) ?? terminal.url() ?? previewFromTerminals(terminal.all()) ?? "",
  )
  const tree = () => state.tree
  const showFiles = createMemo(() => state.mode !== "preview" && state.files)
  const box = createMemo(() => state.box || 1200)
  const leftMax = createMemo(() => Math.max(260, Math.min(460, box() * 0.38)))
  const rightMax = createMemo(() => Math.max(360, Math.min(960, box() * 0.68)))
  const left = createMemo(() => (showFiles() ? state.left : 0))
  const right = createMemo(() => {
    if (state.mode === "code") return 0
    if (state.mode === "preview") return box()
    return state.right
  })
  const edit = createMemo(() => Math.max(0, box() - left() - right()))
  const open = (path: string) => !!state.open[path]
  const wait = (path: string) => !!state.wait[path]
  const setMode = (mode: Mode) => {
    setState("mode", mode)
    if (mode === "preview" || state.files) return
    openFiles()
  }
  const donePick = () => {
    setState("pick", false)
    setState("doc", "")
    setState("waitPick", false)
  }
  const pick = () => {
    const url = state.url
    if (!url) {
      showToast({
        variant: "error",
        title: "No preview is running",
        description: "Run the app first, then turn on element selection.",
      })
      return
    }

    if (state.pick) {
      donePick()
      return
    }

    setState("waitPick", true)
    const run = platform.fetch ?? fetch
    void run(url)
      .then((res) => res.text())
      .then((html) => {
        setState("doc", pickDoc(url, html))
        setState("pick", true)
        setState("waitPick", false)
      })
      .catch(() => {
        setState("waitPick", false)
        showToast({
          variant: "error",
          title: "Could not load preview picker",
          description: url,
        })
      })
  }

  const load = async (path: string, force = false) => {
    if (!api()) return
    if (!force && (state.tree[path] || state.wait[path])) return
    setState("wait", path, true)
    const next = await api()!
      .list(path)
      .then((list) => list.map((item) => ({ name: item.name, path: item.path, dir: item.dir, file: item.file })))
      .catch(() => null)
    setState("wait", path, false)
    if (!next) return
    setState("tree", path, next)
  }

  const read = async (path: string) => {
    if (!api()) return
    const hit = state.tabs.find((item) => item.path === path)
    if (hit) {
      setState("active", path)
      return
    }

    const next = await api()!.read(path).catch(() => null)
    if (next === null) {
      showToast({
        variant: "error",
        title: "Could not open file",
        description: path,
      })
      return
    }

    setState("tabs", (list) => [...list, { name: base(path), path, value: next, saved: next, dirty: false }])
    setState("active", path)
    if (state.mode === "preview") setState("mode", "split")
  }

  const change = (path: string, value: string) => {
    setState("tabs", (list) =>
      list.map((item) => (item.path === path ? { ...item, value, dirty: value !== item.saved } : item)),
    )
  }

  const close = (path: string) => {
    const list = state.tabs.filter((item) => item.path !== path)
    setState("tabs", list)
    if (state.active !== path) return
    setState("active", list.at(-1)?.path ?? "")
  }

  const save = async () => {
    const cur = tab()
    if (!cur || !api()) return
    const ok = await api()!
      .write(cur.path, cur.value)
      .then(() => true)
      .catch(() => false)

    if (!ok) {
      showToast({
        variant: "error",
        title: "Could not save file",
        description: cur.path,
      })
      return
    }

    setState("tabs", (list) =>
      list.map((item) => (item.path === cur.path ? { ...item, saved: cur.value, dirty: false } : item)),
    )
  }

  const refresh = (paths?: string[]) => {
    if (tick !== undefined) clearTimeout(tick)
    tick = window.setTimeout(async () => {
      const dirs = Object.keys(state.open).filter((path) => state.open[path])
      await Promise.all(dirs.map((path) => load(path, true)))
      const clean = state.tabs.filter((item) => !item.dirty && (!paths || paths.some((path) => path === item.path)))
      await Promise.all(
        clean.map(async (item) => {
          if (!api()) return
          const next = await api()!.read(item.path).catch(() => null)
          if (next === null) return
          setState("tabs", (list) =>
            list.map((tab) => (tab.path === item.path ? { ...tab, value: next, saved: next, dirty: false } : tab)),
          )
        }),
      )
    }, 180)
  }

  const openFiles = () => {
    setState("files", true)
    void load(root(), true)
  }

  createResizeObserver(
    () => wrap,
    ({ width }) => {
      const next = Math.ceil(width)
      if (!next || next === state.box) return
      setState("box", next)
    },
  )

  createEffect(() => {
    const dir = root()
    const fs = api()
    if (!dir || !fs) return
    stop?.()
    setState("open", dir, true)
    void load(dir, true)
    void fs.watch(dir, (event) => refresh(event.paths)).then((fn) => {
      stop = fn
    })
  })

  createEffect(() => {
    const max = leftMax()
    if (state.left <= max) return
    setState("left", Math.round(max))
  })

  createEffect(() => {
    const max = rightMax()
    if (state.right <= max) return
    setState("right", Math.round(max))
  })

  command.register("workbench.preview", () => {
    const list = [
      {
        id: "workbench.mode.code",
        title: "Show Code",
        category: "Workbench",
        disabled: state.mode === "code",
        onSelect: () => setMode("code"),
      },
      {
        id: "workbench.mode.split",
        title: "Show Code + Preview",
        category: "Workbench",
        disabled: state.mode === "split",
        onSelect: () => setMode("split"),
      },
      {
        id: "workbench.mode.preview",
        title: "Show Preview",
        category: "Workbench",
        disabled: state.mode === "preview",
        onSelect: () => setMode("preview"),
      },
      {
        id: "workbench.explorer.toggle",
        title: state.files ? "Hide Explorer" : "Show Explorer",
        category: "Workbench",
        onSelect: () => {
          if (state.files) {
            setState("files", false)
            return
          }
          openFiles()
        },
      },
    ]

    if (props.onChatToggle) {
      list.push({
        id: "workbench.chat.toggle",
        title: props.chatHidden ? "Show Chat" : "Hide Chat",
        category: "Workbench",
        onSelect: props.onChatToggle,
      })
    }

    return list
  })

  createEffect(() => {
    const next = detected()
    if (!next || next === state.url) return
    donePick()
    setState("url", next)
  })

  createEffect(
    on(
      () => `${root()}\n${params.id ?? ""}`,
      () => {
        donePick()
        setState("url", "")
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return
      if (typeof event.data !== "object" || !event.data) return
      if ((event.data as { source?: string }).source !== "paddie-studio-preview") return

      const type = (event.data as { type?: string }).type
      if (type === "cancel") {
        donePick()
        return
      }

      if (type !== "pick") return
      const data = (event.data as { payload?: Record<string, unknown> }).payload
      if (!data) return
      const url = typeof data.url === "string" ? data.url : state.url
      const selector = typeof data.selector === "string" ? data.selector : ""
      const label = typeof data.label === "string" ? data.label : selector || "selected element"
      const html = typeof data.html === "string" ? data.html : ""
      const text = typeof data.text === "string" ? data.text : undefined
      if (!url || !selector || !html) return

      prompt.context.items()
        .filter((item) => item.type === "element" && item.url === url && item.selector === selector)
        .forEach((item) => prompt.context.remove(item.key))

      prompt.context.add({
        type: "element",
        url,
        selector,
        label,
        html,
        text,
      })
      if (props.chatHidden) props.onChatToggle?.()
      requestAnimationFrame(() => {
        const node = document.querySelector('[data-component="prompt-input"]')
        if (node instanceof HTMLElement) node.focus()
      })
      donePick()
      showToast({
        title: "Element added to chat",
        description: label,
      })
    }

    window.addEventListener("message", onMessage)
    onCleanup(() => window.removeEventListener("message", onMessage))
  })

  onCleanup(() => {
    stop?.()
    if (tick !== undefined) clearTimeout(tick)
  })

  const pane =
    "h-full shrink-0 min-w-0 overflow-hidden transition-[width,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,opacity] motion-reduce:transition-none"

  if (!api()) {
    return (
      <div class="size-full flex items-center justify-center bg-background-base">
        <div class="text-14-medium text-text-weak">Workbench is only available in the desktop app.</div>
      </div>
    )
  }

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      classList={{
        "h-7 px-2 rounded-md text-11-medium transition-colors": true,
        "bg-surface-base-active text-text-strong": state.mode === value,
        "text-text-weak hover:bg-surface-base-hover hover:text-text-base": state.mode !== value,
      }}
      onClick={() => setMode(value)}
    >
      {label}
    </button>
  )

  return (
    <div ref={wrap} class="size-full bg-background-base flex flex-col overflow-hidden">
      <div class="h-11 shrink-0 border-b border-border-weaker-base flex items-center justify-between gap-3 px-3">
        <div class="min-w-0 flex items-center gap-3">
          <div class="min-w-0">
            <div class="text-11-medium text-text-weak">Studio</div>
            <div class="text-12-medium text-text-base truncate">{base(root()) || root()}</div>
          </div>
          <div class="h-8 p-0.5 rounded-lg border border-border-weaker-base bg-surface-base flex items-center gap-0.5">
            {modeButton("code", "Code")}
            {modeButton("split", "Split")}
            {modeButton("preview", "Preview")}
          </div>
          <Show when={state.mode !== "preview"}>
            <button
              type="button"
              classList={{
                "h-7 px-2 rounded-md text-11-medium transition-colors": true,
                "bg-surface-base-active text-text-strong": state.files,
                "text-text-weak hover:bg-surface-base-hover hover:text-text-base": !state.files,
              }}
              onClick={() => {
                if (state.files) {
                  setState("files", false)
                  return
                }
                openFiles()
              }}
            >
              Explorer
            </button>
          </Show>
        </div>

        <div class="shrink-0 flex items-center gap-2">
          <Show when={props.onChatToggle}>
            <Button variant="ghost" class="h-8 px-3 text-12-medium" onClick={props.onChatToggle}>
              {props.chatHidden ? "Show chat" : "Hide chat"}
            </Button>
          </Show>
          <Show when={props.onClose}>
            <Button variant="ghost" class="h-8 px-3 text-12-medium" onClick={props.onClose}>
              {language.t("common.close")}
            </Button>
          </Show>
        </div>
      </div>

      <div class="min-h-0 flex-1 flex overflow-hidden">
        <aside
          class={`${pane} bg-surface-base`}
          classList={{
            "border-r border-border-weaker-base": left() > 0,
            "pointer-events-none opacity-0": left() === 0,
          }}
          style={{ width: `${left()}px` }}
        >
          <div class="h-11 px-3 border-b border-border-weaker-base flex items-center justify-between gap-2">
            <div class="text-12-medium text-text-weak">Files</div>
            <Button
              variant="ghost"
              class="h-8 px-2 text-12-medium"
              onClick={() => void load(root(), true)}
              aria-label="Refresh files"
            >
              <Icon name="reset" size="small" />
            </Button>
          </div>
          <div class="h-[calc(100%-44px)] overflow-auto p-2">
            <Tree
              path={root()}
              level={0}
              active={() => state.active}
              load={load}
              open={open}
              wait={wait}
              tree={tree}
              toggle={(path) => setState("open", path, (value) => !value)}
              file={read}
            />
          </div>
        </aside>

        <Show when={state.files && state.mode !== "preview"}>
          <div class="relative shrink-0" onPointerDown={() => undefined}>
            <ResizeHandle
              direction="horizontal"
              size={state.left}
              min={220}
              max={leftMax()}
              onResize={(size) => setState("left", size)}
            />
          </div>
        </Show>

        <section
          class={`${pane} flex flex-col`}
          classList={{
            "pointer-events-none opacity-0": edit() === 0,
          }}
          style={{ width: `${edit()}px` }}
        >
          <div class="h-11 border-b border-border-weaker-base flex items-center justify-between gap-3 px-3">
            <div class="min-w-0 flex-1 flex items-center gap-1 overflow-x-auto">
              <For each={state.tabs}>
                {(item) => (
                  <div
                    classList={{
                      "h-8 pl-2 pr-1 rounded-md flex items-center gap-2 shrink-0 border": true,
                      "bg-surface-base-active border-border-weak-base": state.active === item.path,
                      "bg-transparent border-transparent hover:bg-surface-base-hover": state.active !== item.path,
                    }}
                  >
                    <button
                      type="button"
                      class="min-w-0 flex-1 flex items-center gap-2"
                      onClick={() => setState("active", item.path)}
                    >
                      <FileIcon node={{ path: item.path, type: "file" }} class="size-4" />
                      <span class="max-w-48 truncate text-12-medium text-text-base">{item.name}</span>
                      <Show when={item.dirty}>
                        <div class="size-1.5 rounded-full bg-icon-info-base" />
                      </Show>
                    </button>
                    <button
                      type="button"
                      class="size-5 rounded-sm flex items-center justify-center hover:bg-surface-raised-base-hover"
                      onClick={(event) => {
                        event.stopPropagation()
                        close(item.path)
                      }}
                      aria-label={`Close ${item.name}`}
                    >
                      <Icon name="close-small" size="small" class="text-icon-base" />
                    </button>
                  </div>
                )}
              </For>
            </div>

            <div class="shrink-0 flex items-center gap-2">
              <Show when={tab()?.dirty}>
                <Button variant="ghost" class="h-8 px-3 text-12-medium" onClick={() => void save()}>
                  {language.t("common.save")}
                </Button>
              </Show>
            </div>
          </div>

          <div class="min-h-0 flex-1">
            <Show
              when={tab()}
              fallback={
                <div class="size-full flex flex-col items-center justify-center gap-3 text-text-weak">
                  <Icon name="code" class="size-8" />
                  <div class="text-14-medium">Open a file from the tree to start editing.</div>
                </div>
              }
            >
              {(item) => (
                <WorkbenchEditor
                  path={item().path}
                  value={item().value}
                  onChange={(value) => change(item().path, value)}
                  onSave={() => void save()}
                />
              )}
            </Show>
          </div>
        </section>

        <Show when={state.mode === "split"}>
          <div class="relative shrink-0" onPointerDown={() => undefined}>
            <ResizeHandle
              direction="horizontal"
              edge="start"
              size={state.right}
              min={320}
              max={rightMax()}
              onResize={(size) => setState("right", size)}
            />
          </div>
        </Show>

        <aside
          class={`${pane} bg-surface-base flex flex-col`}
          classList={{
            "border-l border-border-weaker-base": state.mode === "split" && right() > 0,
            "pointer-events-none opacity-0": right() === 0,
          }}
          style={{ width: `${right()}px` }}
        >
          <div class="p-3 border-b border-border-weaker-base flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-13-medium text-text-base">Preview</div>
              <div class="min-w-0 flex items-center gap-2">
                <Show when={state.url}>
                  {(url) => <div class="min-w-0 text-11-medium text-text-weak truncate">{url()}</div>}
                </Show>
                <Button
                  variant="ghost"
                  class={state.pick ? "h-8 px-2 bg-surface-base-active text-text-strong" : "h-8 px-2"}
                  disabled={!state.url || state.waitPick}
                  onClick={pick}
                  aria-label={state.pick ? "Stop selecting elements" : "Select an element from preview"}
                >
                  <Icon name="window-cursor" class="size-4" />
                </Button>
              </div>
            </div>

            <div class="text-11-medium text-text-weak">
              {state.waitPick
                ? "Loading the picker snapshot..."
                : state.pick
                  ? "Click any element in the preview to add it to the chat box."
                  : state.url
                    ? "Following the latest localhost app from chat or terminal."
                    : "Run the app in the main terminal or ask the assistant to run it, then the preview will appear here."}
            </div>
          </div>

          <div class="min-h-0 flex-1 bg-background-base w-full">
            <Show
              when={state.url}
              fallback={
                <div class="size-full flex items-center justify-center px-6 text-center text-13-medium text-text-weak">
                  Preview will appear automatically when a localhost app is running in this workspace.
                </div>
              }
            >
              {(url) => (
                <iframe
                  ref={frame}
                  src={state.pick && state.doc ? undefined : url()}
                  srcdoc={state.pick && state.doc ? state.doc : undefined}
                  class="block size-full bg-white"
                  title="Preview"
                />
              )}
            </Show>
          </div>
        </aside>
      </div>
    </div>
  )
}
