import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { Terminal } from "@/components/terminal"
import { WorkbenchEditor } from "@/components/workbench-editor"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useTerminal } from "@/context/terminal"
import { detectPreview, type PreviewTarget } from "@/utils/workbench-preview"

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

const find = (text: string) => {
  const hit = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[a-z0-9.-]+):\d+(?:\/\S*)?/i)?.[0]
  if (!hit) return
  return hit.replace("0.0.0.0", "localhost").replace("[::1]", "localhost")
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
  const sdk = useSDK()
  const sync = useSync()
  const terminal = useTerminal()
  const api = () => platform.workbench
  const root = createMemo(() => sync.data.path.directory || sdk.directory)
  const [frame, setFrame] = createSignal(0)
  const [state, setState] = createStore({
    files: true,
    left: 280,
    right: 420,
    mode: "split" as Mode,
    tree: {} as Record<string, Node[]>,
    wait: {} as Record<string, boolean>,
    open: {} as Record<string, boolean>,
    tabs: [] as Tab[],
    active: "",
    targets: [] as PreviewTarget[],
    target: "",
    pty: "",
    url: "",
    err: "",
  })

  let frameRef: HTMLIFrameElement | undefined
  let stop: VoidFunction | undefined
  let tick: number | undefined

  const tab = createMemo(() => state.tabs.find((item) => item.path === state.active))
  const target = createMemo(() => state.targets.find((item) => item.id === state.target))
  const pty = createMemo(() => terminal.all().find((item) => item.id === state.pty))
  const running = createMemo(() => !!pty())
  const tree = () => state.tree
  const open = (path: string) => !!state.open[path]
  const wait = (path: string) => !!state.wait[path]
  const note = (text: string) => {
    const next = find(text)
    if (next) setState("url", next)
  }
  const hint = (path?: string) => {
    const name = base(path ?? "").toLowerCase()
    if (name === "package.json") return true
    if (name === "bun.lock" || name === "bun.lockb" || name === "yarn.lock" || name === "pnpm-lock.yaml") return true
    if (name === "package-lock.json" || name === "npm-shrinkwrap.json") return true
    if (name.startsWith("vite.config.") || name.startsWith("next.config.") || name.startsWith("nuxt.config.")) return true
    if (name.startsWith("astro.config.") || name.startsWith("svelte.config.")) return true
    return false
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

    if (cur.path.endsWith("package.json")) void scan()
  }

  const scan = async () => {
    if (!api()) return
    const list = await detectPreview({
      fs: api()!,
      root: root(),
      os: platform.os,
    }).catch(() => [])
    const next = list[0]?.id ?? ""
    setState("targets", list)
    setState("target", (value) => (list.some((item) => item.id === value) ? value : next))
  }

  const stopPreview = async () => {
    const id = state.pty
    setState("pty", "")
    if (!id) return
    await terminal.close(id).catch(() => undefined)
  }

  const run = async () => {
    const cmd = target()
    if (!cmd || running()) return
    await stopPreview()
    setState("err", "")
    setState("url", "")
    const next = await sdk.client.pty
      .create({
        command: cmd.cmd,
        args: cmd.args,
        cwd: cmd.cwd,
        title: "Preview",
      })
      .catch((err) => {
        setState("err", String(err))
        return null
      })

    const id = next?.data?.id
    if (!id) return
    terminal.open(id)
    setState("pty", id)
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
      if (paths?.some((path) => hint(path))) await scan()
    }, 180)
  }

  const openFiles = () => {
    setState("files", true)
    void load(root(), true)
  }

  createEffect(() => {
    const dir = root()
    const fs = api()
    if (!dir || !fs) return
    stop?.()
    setState("open", dir, true)
    void load(dir, true)
    void scan()
    void fs.watch(dir, (event) => refresh(event.paths)).then((fn) => {
      stop = fn
    })
  })

  command.register("workbench.preview", () => {
    const list = [
      {
        id: "workbench.preview.run",
        title: "Run Preview",
        category: "Workbench",
        disabled: !target() || running(),
        onSelect: () => void run(),
      },
      {
        id: "workbench.preview.stop",
        title: "Stop Preview",
        category: "Workbench",
        disabled: !running(),
        onSelect: () => void stopPreview(),
      },
      {
        id: "workbench.preview.reload",
        title: "Reload Preview Frame",
        category: "Workbench",
        disabled: !state.url,
        onSelect: () => {
          setFrame((value) => value + 1)
          frameRef?.contentWindow?.location.reload()
        },
      },
      {
        id: "workbench.preview.rescan",
        title: "Rescan Preview Target",
        category: "Workbench",
        onSelect: () => void scan(),
      },
      {
        id: "workbench.mode.code",
        title: "Show Code",
        category: "Workbench",
        disabled: state.mode === "code",
        onSelect: () => setState("mode", "code"),
      },
      {
        id: "workbench.mode.split",
        title: "Show Code + Preview",
        category: "Workbench",
        disabled: state.mode === "split",
        onSelect: () => setState("mode", "split"),
      },
      {
        id: "workbench.mode.preview",
        title: "Show Preview",
        category: "Workbench",
        disabled: state.mode === "preview",
        onSelect: () => setState("mode", "preview"),
      },
      {
        id: "workbench.files.toggle",
        title: state.files ? "Hide Files" : "Show Files",
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
    const id = state.pty
    if (!id) return
    if (terminal.all().some((item) => item.id === id)) return
    setState("pty", "")
  })

  createEffect(() => {
    if (state.pty) return
    const next = [...terminal.all()].reverse().find((item) => /\bpreview\b/i.test(item.title))
    if (!next) return
    setState("pty", next.id)
  })

  onCleanup(() => {
    stop?.()
    if (tick !== undefined) clearTimeout(tick)
  })

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
      onClick={() => setState("mode", value)}
    >
      {label}
    </button>
  )

  return (
    <div class="size-full bg-background-base flex flex-col">
      <div class="h-11 shrink-0 border-b border-border-weaker-base flex items-center justify-between gap-3 px-3">
        <div class="min-w-0 flex items-center gap-3">
          <div class="min-w-0">
            <div class="text-11-medium text-text-weak">Studio</div>
            <div class="text-12-medium text-text-base truncate">{base(root()) || root()}</div>
          </div>
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
            Files
          </button>
          <div class="h-8 p-0.5 rounded-lg border border-border-weaker-base bg-surface-base flex items-center gap-0.5">
            {modeButton("code", "Code")}
            {modeButton("split", "Split")}
            {modeButton("preview", "Preview")}
          </div>
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

      <div class="min-h-0 flex-1 flex">
        <Show when={state.files}>
          <aside class="h-full shrink-0 border-r border-border-weaker-base bg-surface-base" style={{ width: `${state.left}px` }}>
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

          <div onPointerDown={() => undefined}>
            <ResizeHandle
              direction="horizontal"
              size={state.left}
              min={220}
              max={typeof window === "undefined" ? 420 : Math.min(520, window.innerWidth * 0.35)}
              onResize={(size) => setState("left", size)}
            />
          </div>
        </Show>

        <Show when={state.mode !== "preview"}>
          <section class="min-w-0 flex-1 flex flex-col">
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
        </Show>

        <Show when={state.mode === "split"}>
          <div onPointerDown={() => undefined}>
            <ResizeHandle
              direction="horizontal"
              edge="start"
              size={state.right}
              min={320}
              max={typeof window === "undefined" ? 640 : Math.min(760, window.innerWidth * 0.55)}
              onResize={(size) => setState("right", size)}
            />
          </div>
        </Show>

        <Show when={state.mode !== "code"}>
          <aside
            class="h-full min-w-0 shrink-0 bg-surface-base flex flex-col"
            classList={{ "border-l border-border-weaker-base": state.mode === "split" }}
            style={state.mode === "split" ? { width: `${state.right}px` } : undefined}
          >
            <div class="p-3 border-b border-border-weaker-base flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <div class="text-13-medium text-text-base">Preview</div>
                <div class="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    class="h-8 px-3 text-12-medium"
                    disabled={!target() || running()}
                    onClick={() => void run()}
                  >
                    {target() ? `Run ${target()!.label}` : "No preview target"}
                  </Button>
                  <Button
                    variant="ghost"
                    class="h-8 px-3 text-12-medium"
                    disabled={!running()}
                    onClick={() => void stopPreview()}
                  >
                    {language.t("prompt.action.stop")}
                  </Button>
                </div>
              </div>

              <Show when={state.targets.length > 0}>
                <div class="flex flex-col gap-1">
                  <Show when={state.targets.length > 1}>
                    <label class="text-11-medium text-text-weak" for="workbench-preview-target">
                      Frontend target
                    </label>
                    <select
                      id="workbench-preview-target"
                      class="h-8 rounded-md border border-border-weak-base bg-background-base px-2 text-12-medium text-text-base"
                      value={state.target}
                      onChange={(event) => setState("target", event.currentTarget.value)}
                    >
                      <For each={state.targets}>
                        {(item) => <option value={item.id}>{(item.rel || "workspace root") + " - " + item.label}</option>}
                      </For>
                    </select>
                  </Show>
                  <div class="text-11-medium text-text-weak">
                    <Show when={target()} keyed>
                      {(item) => `${item.rel || "workspace root"}${item.note ? ` - ${item.note}` : ""}`}
                    </Show>
                  </div>
                </div>
              </Show>

              <TextField
                value={state.url}
                onChange={(value) => setState("url", value)}
                placeholder="http://localhost:3000"
                label="Preview URL"
                hideLabel
              />

              <div class="flex items-center justify-between gap-2 text-11-medium text-text-weak">
                <span>
                  {running()
                    ? "Running in the shared terminal."
                    : state.pty
                      ? "Preview stopped."
                      : "Waiting for a localhost URL from the preview terminal."}
                </span>
                <Button
                  variant="ghost"
                  class="h-7 px-2 text-11-medium"
                  onClick={() => {
                    setFrame((value) => value + 1)
                    frameRef?.contentWindow?.location.reload()
                  }}
                >
                  Reload frame
                </Button>
              </div>
            </div>

            <div class="min-h-0 flex-1 border-b border-border-weaker-base bg-background-base">
              <Show
                when={state.url}
                fallback={
                  <div class="size-full flex items-center justify-center px-6 text-center text-13-medium text-text-weak">
                    Start a dev server or paste a localhost URL to preview the app here.
                  </div>
                }
              >
                {(url) => (
                  <iframe ref={frameRef} data-frame={frame()} src={url()} class="size-full bg-white" title="Preview" />
                )}
              </Show>
            </div>

            <div class="h-48 min-h-0 border-t border-border-weaker-base bg-background-stronger">
              <Show
                when={pty()}
                fallback={
                  <div class="size-full flex items-center justify-center px-6 text-center">
                    <Show
                      when={state.err}
                      fallback={
                        <div class="text-13-medium text-text-weak">
                          {state.targets.length > 0
                            ? "Run the preview to open the shared terminal here."
                            : "No frontend target detected in this workspace."}
                        </div>
                      }
                    >
                      {(err) => <div class="font-mono text-11 whitespace-pre-wrap break-words text-status-error-base">{err()}</div>}
                    </Show>
                  </div>
                }
              >
                {(item) => (
                  <div class="size-full">
                    <Terminal
                      pty={item()}
                      autoFocus={false}
                      onConnect={() => terminal.trim(item().id)}
                      onCleanup={terminal.bind().update}
                      onConnectError={() => terminal.bind().clone(item().id)}
                      onOutput={note}
                    />
                  </div>
                )}
              </Show>
            </div>
          </aside>
        </Show>
      </div>
    </div>
  )
}
