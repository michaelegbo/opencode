import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSync } from "@/context/sync"
import { WorkbenchEditor } from "@/components/workbench-editor"

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

type Log = {
  id: number
  kind: "info" | "out" | "err"
  text: string
}

type Cmd = {
  label: string
  cmd: string
  args: string[]
}

type Pkg = {
  packageManager?: string
  scripts?: Record<string, string>
}

type Mgr = "bun" | "npm" | "pnpm" | "yarn"

type Lock = {
  mgr: Mgr
  time: number
}

const join = (dir: string, name: string) => {
  const root = dir.replace(/[\\/]+$/, "")
  if (!root) return name
  const sep = root.includes("\\") ? "\\" : "/"
  return `${root}${sep}${name}`
}

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

const lines = (kind: Log["kind"], text: string) => {
  const out = text
    .replace(/\r/g, "")
    .split("\n")
    .flatMap((item) => (item ? [{ id: Date.now() + Math.random(), kind, text: item }] : []))
  if (out.length > 0) return out
  return [{ id: Date.now() + Math.random(), kind, text }]
}

const rank = (key: string, value: string) => {
  let score = 0
  const name = key.toLowerCase()
  const body = value.toLowerCase()

  if (name === "dev:web") score += 120
  if (name === "web:dev") score += 115
  if (name === "dev:app" || name === "app:dev") score += 100
  if (name === "dev:frontend" || name === "frontend:dev") score += 95
  if (name === "dev:client" || name === "client:dev") score += 90
  if (name === "preview") score += 70
  if (name === "serve") score += 65
  if (name === "start") score += 55
  if (name === "dev") score += 50

  if (/(vite|next dev|nuxt dev|astro dev|solid-start|webpack serve|webpack-dev-server|react-scripts|rspack|parcel|remix dev)/.test(body)) {
    score += 40
  }

  if (/(storybook|tauri|electron|lint|test|build|deploy)/.test(body)) {
    score -= 80
  }

  return score
}

const choose = (scripts: Record<string, string>) =>
  Object.entries(scripts)
    .map(([key, value]) => ({ key, value, score: rank(key, value) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.key

const score = (mgr: Mgr) => {
  if (mgr === "npm") return 4
  if (mgr === "pnpm") return 3
  if (mgr === "yarn") return 2
  return 1
}

const manager = (pkg: Pkg, locks: Lock[]) => {
  const name = pkg.packageManager?.split("@")[0]
  if (name === "bun" || name === "pnpm" || name === "yarn" || name === "npm") return name

  const next = Array.from(
    locks.reduce((map, item) => {
      map.set(item.mgr, Math.max(map.get(item.mgr) ?? 0, item.time))
      return map
    }, new Map<Mgr, number>()),
    ([mgr, time]) => ({ mgr, time }),
  ).sort((a, b) => b.time - a.time || score(b.mgr) - score(a.mgr))[0]?.mgr

  if (next) return next
  return "npm"
}

const preview = (mgr: Mgr, script: string): Cmd => {
  if (mgr === "bun") return { label: `bun run ${script}`, cmd: "preview-bun", args: ["run", script] }
  if (mgr === "pnpm") return { label: `pnpm ${script}`, cmd: "preview-pnpm", args: [script] }
  if (mgr === "yarn") return { label: `yarn ${script}`, cmd: "preview-yarn", args: [script] }
  return { label: `npm run ${script}`, cmd: "preview-npm", args: ["run", script] }
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

export default function Workbench() {
  const language = useLanguage()
  const platform = usePlatform()
  const sync = useSync()
  const api = () => platform.workbench
  const root = createMemo(() => sync.data.path.directory)
  const [frame, setFrame] = createSignal(0)
  const [state, setState] = createStore({
    left: 280,
    right: 420,
    tree: {} as Record<string, Node[]>,
    wait: {} as Record<string, boolean>,
    open: {} as Record<string, boolean>,
    tabs: [] as Tab[],
    active: "",
    logs: [] as Log[],
    cmd: undefined as Cmd | undefined,
    run: false,
    pid: 0,
    url: "",
  })

  let log: HTMLDivElement | undefined
  let frameRef: HTMLIFrameElement | undefined
  let stop: VoidFunction | undefined
  let tick: number | undefined
  let proc: { kill: () => Promise<void> } | undefined

  const tab = createMemo(() => state.tabs.find((item) => item.path === state.active))
  const tree = () => state.tree
  const open = (path: string) => !!state.open[path]
  const wait = (path: string) => !!state.wait[path]
  const push = (kind: Log["kind"], text: string) => {
    setState("logs", (list) => [...list, ...lines(kind, text)].slice(-400))
    const next = find(text)
    if (next && !state.url) setState("url", next)
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
    const next = list.at(-1)?.path ?? ""
    setState("active", next)
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
    const path = join(root(), "package.json")
    const pkg = await api()!
      .read(path)
      .then((text) => JSON.parse(text) as Pkg)
      .catch(() => null)

    const scripts = pkg?.scripts ?? {}
    const script = choose(scripts)
    if (!script) {
      setState("cmd", undefined)
      return
    }

    const locks = await Promise.all(
      [
        { mgr: "bun" as const, path: "bun.lock" },
        { mgr: "bun" as const, path: "bun.lockb" },
        { mgr: "pnpm" as const, path: "pnpm-lock.yaml" },
        { mgr: "yarn" as const, path: "yarn.lock" },
        { mgr: "npm" as const, path: "package-lock.json" },
        { mgr: "npm" as const, path: "npm-shrinkwrap.json" },
      ].map(async (item) => {
        const next = await api()!.stat(join(root(), item.path)).catch(() => null)
        if (!next) return
        return {
          mgr: item.mgr,
          time: next.mtime ?? 0,
        }
      }),
    ).then((list) => list.filter((item): item is Lock => !!item))

    const mgr = manager(pkg ?? {}, locks)
    setState("cmd", preview(mgr, script))
  }

  const stopPreview = async () => {
    const cur = proc
    proc = undefined
    setState("run", false)
    setState("pid", 0)
    await cur?.kill().catch(() => undefined)
  }

  const run = async () => {
    const cmd = state.cmd
    if (!cmd || !api() || state.run) return
    setState("run", true)
    setState("pid", 0)
    push("info", `$ ${cmd.label}`)
    const child = await api()!
      .spawn({
        cmd: cmd.cmd,
        args: cmd.args,
        cwd: root(),
        stdout: (text) => push("out", text),
        stderr: (text) => push("err", text),
        error: (text) => push("err", text),
        close: (data) => {
          proc = undefined
          setState("run", false)
          setState("pid", 0)
          push("info", data.code === null ? "Preview stopped" : `Preview exited with code ${data.code}`)
        },
      })
      .catch((err) => {
        setState("run", false)
        push("err", String(err))
        return null
      })

    if (!child) return
    proc = child
    setState("pid", child.pid)
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

  createEffect(() => {
    const next = state.logs.length
    if (!next) return
    requestAnimationFrame(() => {
      if (!log) return
      log.scrollTop = log.scrollHeight
    })
  })

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

  onCleanup(() => {
    stop?.()
    if (tick !== undefined) clearTimeout(tick)
    void stopPreview()
  })

  if (!api()) {
    return (
      <div class="size-full flex items-center justify-center bg-background-base">
        <div class="text-14-medium text-text-weak">Workbench is only available in the desktop app.</div>
      </div>
    )
  }

  return (
    <div class="size-full bg-background-base flex">
      <aside class="h-full shrink-0 border-r border-border-weaker-base bg-surface-base" style={{ width: `${state.left}px` }}>
        <div class="h-11 px-3 border-b border-border-weaker-base flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-12-medium text-text-weak">Files</div>
            <div class="text-13-medium text-text-base truncate">{base(root()) || root()}</div>
          </div>
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
          max={typeof window === "undefined" ? 420 : Math.min(520, window.innerWidth * 0.4)}
          onResize={(size) => setState("left", size)}
        />
      </div>

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
                  <button type="button" class="min-w-0 flex-1 flex items-center gap-2" onClick={() => setState("active", item.path)}>
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

      <div onPointerDown={() => undefined}>
        <ResizeHandle
          direction="horizontal"
          edge="start"
          size={state.right}
          min={320}
          max={typeof window === "undefined" ? 640 : Math.min(720, window.innerWidth * 0.55)}
          onResize={(size) => setState("right", size)}
        />
      </div>

      <aside class="h-full shrink-0 border-l border-border-weaker-base bg-surface-base flex flex-col" style={{ width: `${state.right}px` }}>
        <div class="p-3 border-b border-border-weaker-base flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-13-medium text-text-base">Preview</div>
            <div class="flex items-center gap-2">
              <Button
                variant="ghost"
                class="h-8 px-3 text-12-medium"
                disabled={!state.cmd || state.run}
                onClick={() => void run()}
              >
                {state.cmd ? `Run ${state.cmd.label}` : "No preview script"}
              </Button>
              <Button
                variant="ghost"
                class="h-8 px-3 text-12-medium"
                disabled={!state.run}
                onClick={() => void stopPreview()}
              >
                {language.t("prompt.action.stop")}
              </Button>
            </div>
          </div>

          <TextField
            value={state.url}
            onChange={(value) => setState("url", value)}
            placeholder="http://localhost:3000"
            label="Preview URL"
            hideLabel
          />

          <div class="flex items-center justify-between gap-2 text-11-medium text-text-weak">
            <span>{state.pid ? `PID ${state.pid}` : "Waiting for a localhost URL from the preview process."}</span>
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
              <iframe
                ref={frameRef}
                data-frame={frame()}
                src={url()}
                class="size-full bg-white"
                title="Preview"
              />
            )}
          </Show>
        </div>

        <div ref={log} class="h-48 overflow-auto p-3 flex flex-col gap-1 bg-surface-base">
          <For each={state.logs}>
            {(item) => (
              <div
                classList={{
                  "font-mono text-11 whitespace-pre-wrap break-words": true,
                  "text-text-weak": item.kind === "info",
                  "text-text-base": item.kind === "out",
                  "text-status-error-base": item.kind === "err",
                }}
              >
                {item.text}
              </div>
            )}
          </For>
        </div>
      </aside>
    </div>
  )
}
