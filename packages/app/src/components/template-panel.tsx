import { useNavigate } from "@solidjs/router"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { Button } from "@opencode-ai/ui/button"
import { Mark } from "@opencode-ai/ui/logo"
import { showToast } from "@opencode-ai/ui/toast"
import { base64Encode } from "@opencode-ai/util/encode"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { usePrompt } from "@/context/prompt"
import { useServer } from "@/context/server"
import { filesFor, materialize, part, template, templates } from "@/template/library"

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "landing-page"

type Device = "desktop" | "tablet" | "mobile"
type Desk = "1920" | "1600" | "1440"

const views = {
  "1920": { w: 1920, h: 1080, label: "1920x1080" },
  "1600": { w: 1600, h: 900, label: "1600x900" },
  "1440": { w: 1440, h: 900, label: "1440x900" },
  tablet: { w: 834, h: 1194, label: "Tablet" },
  mobile: { w: 430, h: 932, label: "Mobile" },
} as const

export function TemplatePanel(props: {
  chatHidden?: boolean
  onChatToggle?: VoidFunction
}) {
  const layout = useLayout()
  const navigate = useNavigate()
  const platform = usePlatform()
  const prompt = usePrompt()
  const server = useServer()
  const list = templates()
  const [id, setID] = createSignal(list[0]?.id ?? "")
  const [pid, setPID] = createSignal("full")
  const [pick, setPick] = createSignal(false)
  const [view, setView] = createSignal<"library" | "detail">("library")
  const [parts, setParts] = createSignal(false)
  const [device, setDevice] = createSignal<Device>("desktop")
  const [desk, setDesk] = createSignal<Desk>("1920")
  const [w, setW] = createSignal(0)
  const [h, setH] = createSignal(0)
  let frame: HTMLIFrameElement | undefined
  let stage: HTMLDivElement | undefined

  const tpl = createMemo(() => template(id()) ?? list[0])
  const hit = createMemo(() => part(tpl(), pid()) ?? tpl()?.parts[0])
  const preset = createMemo(() => {
    const next = device()
    if (next === "desktop") return views[desk()]
    return views[next]
  })
  const chrome = 40
  const boxW = createMemo(() => Math.max(0, w() - 32))
  const boxH = createMemo(() => Math.max(0, h() - 32))
  const frameW = createMemo(() => preset().w)
  const shellH = createMemo(() => preset().h + chrome)
  const scale = createMemo(() => {
    const x = boxW()
    const y = boxH()
    if (!x || !y) return 1
    return Math.min(1, x / frameW(), y / shellH())
  })
  const scaledW = createMemo(() => Math.max(0, Math.min(boxW(), Math.floor(frameW() * scale()))))
  const scaledH = createMemo(() => Math.max(0, Math.min(boxH(), Math.floor(shellH() * scale()))))
  const reset = () => {
    const cur = tpl()
    if (!cur || !frame) return
    frame.srcdoc = cur.preview
  }
  const sync = () =>
    frame?.contentWindow?.postMessage(
      {
        source: "paddie-studio-template-host",
        type: "pick",
        active: pick(),
      },
      "*",
    )

  const focus = () => {
    if (props.chatHidden) props.onChatToggle?.()
    requestAnimationFrame(() => {
      const node = document.querySelector('[data-component="prompt-input"]')
      if (node instanceof HTMLElement) node.focus()
    })
  }

  const open = (next: string) => {
    setID(next)
    setPID("full")
    setPick(false)
    setParts(false)
    setDevice("desktop")
    setDesk("1920")
    setView("detail")
  }

  const back = () => {
    setPick(false)
    setParts(false)
    setView("library")
  }

  const attach = (
    next?: string,
    opts?: {
      selector?: string
      label?: string
      html?: string
      text?: string
      focus?: boolean
      toast?: boolean
    },
  ) => {
    const cur = tpl()
    if (!cur) return
    const item = part(cur, next ?? pid()) ?? cur.parts[0]
    if (!item) return
    setPID(item.id)
    prompt.context.add({
      type: "template",
      templateID: cur.id,
      templateName: cur.name,
      description: item.id === "full" ? cur.description : item.description,
      stack: cur.stack,
      partID: item.id,
      partName: item.name,
      hint: item.hint,
      selector: opts?.selector,
      label: opts?.label,
      html: opts?.html,
      text: opts?.text,
      files: filesFor(cur, item),
    })
    if (opts?.focus ?? true) focus()
    if (opts?.focus === false && props.chatHidden) props.onChatToggle?.()
    if (opts?.toast ?? true) {
      showToast({
        title: "Template added to chat",
        description: opts?.label ? `${cur.name} - ${opts.label}` : `${cur.name} - ${item.name}`,
      })
    }
  }

  const create = async () => {
    const cur = tpl()
    const fs = platform.workbench
    if (!cur || !fs || !platform.openDirectoryPickerDialog) {
      showToast({
        variant: "error",
        title: "Templates need the desktop app",
        description: "Create-from-template is only available in the desktop build.",
      })
      return
    }

    const parent = await platform.openDirectoryPickerDialog({
      title: "Choose a parent folder",
      multiple: false,
    })
    const root = Array.isArray(parent) ? parent[0] : parent
    if (!root) return

    const raw = window.prompt("Project name", slug(cur.name))
    const name = raw?.trim()
    if (!name) return

    const next = await fs
      .create({ parent: root, name: slug(name), files: materialize(cur, name) })
      .catch((err) => {
        showToast({
          variant: "error",
          title: "Could not create project",
          description: err instanceof Error ? err.message : String(err),
        })
        return
      })
    if (!next) return

    layout.projects.open(next)
    server.projects.touch(next)
    navigate(`/${base64Encode(next)}`)
    showToast({
      title: "Project created",
      description: next,
    })
  }

  onMount(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return
      if (typeof event.data !== "object" || !event.data) return
      if ((event.data as { source?: string }).source !== "paddie-studio-template") return
      if ((event.data as { type?: string }).type === "ready") {
        sync()
        return
      }
      if ((event.data as { type?: string }).type === "cancel") {
        setPick(false)
        return
      }
      if ((event.data as { type?: string }).type !== "pick") return
      const data = (event.data as {
        payload?: {
          id?: string
          selector?: string
          label?: string
          html?: string
          text?: string
        }
      }).payload
      if (!data) return
      const cur = tpl()
      const item = cur && data.id ? part(cur, data.id) : undefined
      setPID(item?.id ?? "full")
      setParts(true)
      attach(item?.id ?? "full", {
        selector: data.selector,
        label: data.label,
        html: data.html,
        text: data.text,
        focus: false,
        toast: false,
      })
      showToast({
        title: "Template element added",
        description: item ? `${cur?.name} - ${item.name} - picker still active` : "Picker still active",
      })
    }

    window.addEventListener("message", onMessage)
    onCleanup(() => window.removeEventListener("message", onMessage))
  })

  createEffect(() => {
    tpl()?.id
    pick()
    queueMicrotask(sync)
  })

  createResizeObserver(
    () => stage,
    () => {
      const nextW = Math.ceil(stage?.clientWidth ?? 0)
      const nextH = Math.ceil(stage?.clientHeight ?? 0)
      if (!nextW || !nextH) return
      if (nextW === w() && nextH === h()) return
      setW(nextW)
      setH(nextH)
    },
  )

  const deskButton = (value: Desk) => (
    <button
      type="button"
      classList={{
        "h-8 shrink-0 px-3 rounded-xl text-11-medium transition-all duration-150 flex items-center justify-center border min-w-max": true,
        "border-border-weak-base bg-background-stronger text-text-strong shadow-xs-border": desk() === value && device() === "desktop",
        "border-transparent text-text-weak hover:bg-surface-base-hover hover:text-text-base": desk() !== value || device() !== "desktop",
      }}
      onClick={() => {
        setDevice("desktop")
        setDesk(value)
      }}
    >
      {views[value].label}
    </button>
  )

  const deviceButton = (value: Device, label: string) => (
    <button
      type="button"
      classList={{
        "h-8 shrink-0 px-3 rounded-xl text-11-medium transition-all duration-150 flex items-center justify-center border": true,
        "border-border-weak-base bg-background-stronger text-text-strong shadow-xs-border": device() === value,
        "border-transparent text-text-weak hover:bg-surface-base-hover hover:text-text-base": device() !== value,
      }}
      onClick={() => setDevice(value)}
    >
      {label}
    </button>
  )

  return (
    <div class="size-full overflow-hidden p-3">
      <div class="size-full overflow-hidden rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)]">
        <Show
          when={view() === "detail" && tpl()}
          fallback={
            <div class="size-full overflow-auto bg-background-base p-3">
              <div class="mx-auto flex max-w-[1200px] flex-col gap-4">
                <div class="rounded-[20px] border border-border-weaker-base bg-surface-base px-4 py-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-xl border border-border-weaker-base bg-background-stronger flex items-center justify-center shadow-xs-border">
                      <Mark class="size-5 text-icon-info-base" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-10-medium uppercase tracking-[0.12em] text-text-weak">Templates</div>
                      <div class="text-15-medium text-text-base">Reference library</div>
                    </div>
                  </div>
                  <div class="mt-3 max-w-[780px] text-13-medium text-text-weak">
                    Browse a starter first, then open it in a desktop canvas. Curated parts stay hidden until you
                    select one or open them yourself.
                  </div>
                </div>

                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <For each={list}>
                    {(item) => (
                      <button
                        type="button"
                        class="rounded-[20px] border border-border-weaker-base bg-background-stronger p-4 text-left transition-colors hover:bg-surface-base-hover"
                        onClick={() => open(item.id)}
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="text-16-medium text-text-base">{item.name}</div>
                            <div class="mt-2 text-13-medium text-text-weak">{item.description}</div>
                          </div>
                          <div class="rounded-full border border-border-weaker-base px-2 py-0.5 text-10-medium text-text-weak">
                            {item.stack}
                          </div>
                        </div>
                        <div class="mt-4 flex items-center justify-between gap-3">
                          <div class="text-11-medium text-text-weak">{item.parts.length} curated parts</div>
                          <div class="rounded-full border border-border-weaker-base px-3 py-1 text-11-medium text-text-base">
                            Open template
                          </div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          }
        >
          {(cur) => (
            <div class="size-full overflow-hidden bg-background-base p-3">
              <div class="size-full min-w-0 flex flex-col gap-3 overflow-hidden">
                <div class="rounded-[18px] border border-border-weaker-base bg-surface-base px-4 py-4 flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" class="h-9 px-3 text-12-medium" onClick={back}>
                        Back to library
                      </Button>
                      <div class="text-10-medium uppercase tracking-[0.12em] text-text-weak">Bundled starter</div>
                      <div class="rounded-full border border-border-weaker-base px-2 py-0.5 text-10-medium text-text-weak">
                        {cur().stack}
                      </div>
                      <Show when={parts()}>
                        <div class="rounded-full border border-border-weaker-base px-2 py-0.5 text-10-medium text-text-weak">
                          Selected: {hit()?.name ?? "Full template"}
                        </div>
                      </Show>
                    </div>
                    <div class="mt-2 text-20-medium text-text-base">{cur().name}</div>
                    <div class="mt-2 max-w-[780px] text-13-medium text-text-weak">{cur().description}</div>
                  </div>
                  <div class="shrink-0 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant={parts() ? "secondary" : "ghost"}
                      class="h-9 px-3 text-12-medium"
                      onClick={() => setParts((value) => !value)}
                    >
                      {parts() ? "Hide curated parts" : "Show curated parts"}
                    </Button>
                    <Button variant="ghost" class="h-9 px-3 text-12-medium" onClick={() => attach("full")}>
                      Attach full template
                    </Button>
                    <Button class="h-9 px-3 text-12-medium" onClick={() => void create()}>
                      Create starter project
                    </Button>
                  </div>
                </div>

                <div class={parts() ? "min-h-0 flex-1 grid grid-cols-[minmax(0,1fr)_320px] gap-3 overflow-hidden" : "min-h-0 flex-1 overflow-hidden"}>
                  <div class="min-h-0 overflow-hidden rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)] flex flex-col">
                    <div class="h-11 border-b border-border-weaker-base bg-[#111218] flex items-center gap-2 px-4">
                      <div class="size-2 rounded-full bg-[#f87171]" />
                      <div class="size-2 rounded-full bg-[#fbbf24]" />
                      <div class="size-2 rounded-full bg-[#34d399]" />
                      <div class="min-w-0 flex-1 text-center text-11-medium text-text-weak truncate">
                        {cur().name} preview
                      </div>
                      <Button
                        variant={pick() ? "secondary" : "ghost"}
                        class="h-7 px-2 text-11-medium"
                        onClick={() => setPick((value) => !value)}
                      >
                        {pick() ? "Stop selecting" : "Select from preview"}
                      </Button>
                    </div>

                    <div class="border-b border-border-weaker-base p-3 flex flex-col gap-3 bg-background-stronger">
                      <div class="flex flex-wrap items-center gap-2 justify-between">
                        <div class="min-w-0 h-9 flex-1 rounded-xl border border-border-weaker-base bg-background-base px-3 flex items-center gap-2">
                          <div class={`size-2 rounded-full ${pick() ? "bg-icon-info-base" : "bg-icon-success-base"}`} />
                          <div class="min-w-0 flex-1 truncate text-11-medium text-text-weak">
                            {pick()
                              ? "Selection mode is on. Click any highlighted element to add it to chat."
                              : "Browsing in desktop mode by default. Switch sizes when you want to inspect the layout."}
                          </div>
                        </div>
                        <div class="min-w-0 shrink-0 max-w-full rounded-xl border border-border-weaker-base bg-background-base p-1 flex items-center gap-1 overflow-x-auto">
                          {deskButton("1920")}
                          {deskButton("1600")}
                          {deskButton("1440")}
                          {deviceButton("tablet", "Tablet")}
                          {deviceButton("mobile", "Mobile")}
                        </div>
                      </div>
                      <div class="text-11-medium text-text-weak">
                        {parts()
                          ? `Curated parts are open for ${hit()?.name ?? "Full template"}.`
                          : "Curated parts stay hidden until you select something or open the panel yourself."}
                      </div>
                    </div>

                    <div class="min-h-0 flex-1 bg-background-stronger p-3">
                      <div ref={stage} class="size-full min-w-0 overflow-auto rounded-[22px] bg-[#181922]">
                        <div class="min-h-full min-w-full flex items-start justify-center p-4">
                          <div class="relative shrink-0" style={{ width: `${scaledW()}px`, height: `${scaledH()}px` }}>
                            <div
                              class="absolute left-0 top-0 box-border overflow-hidden rounded-[22px] border border-border-weaker-base bg-[#14151d] shadow-[var(--shadow-lg-border-base)] flex flex-col"
                              style={{
                                width: `${frameW()}px`,
                                height: `${shellH()}px`,
                                transform: `scale(${scale()})`,
                                "transform-origin": "top left",
                              }}
                            >
                              <div class="h-10 shrink-0 border-b border-border-weaker-base bg-[#111218] flex items-center gap-2 px-4">
                                <div class="size-2 rounded-full bg-[#f87171]" />
                                <div class="size-2 rounded-full bg-[#fbbf24]" />
                                <div class="size-2 rounded-full bg-[#34d399]" />
                                <div class="min-w-0 flex-1 text-center text-11-medium text-text-weak truncate">
                                  {cur().name}
                                </div>
                              </div>
                              <iframe
                                ref={frame}
                                srcdoc={cur().preview}
                                sandbox="allow-scripts allow-same-origin"
                                class="block min-h-0 flex-1 w-full border-0 bg-white"
                                title={`${cur().name} preview`}
                                onLoad={() => {
                                  const doc = frame?.contentDocument
                                  if (!doc?.body?.hasAttribute("data-paddie-template")) {
                                    reset()
                                    return
                                  }
                                  sync()
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Show when={parts()}>
                    <div class="min-h-0 overflow-auto rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)] p-3">
                      <div class="text-10-medium uppercase tracking-[0.12em] text-text-weak">Curated parts</div>
                      <div class="mt-2 text-13-medium text-text-base">Selected parts and reference files</div>
                      <div class="mt-3 space-y-2">
                        <For each={cur().parts}>
                          {(item) => (
                            <div
                              classList={{
                                "rounded-[18px] border px-3 py-3 transition-colors cursor-pointer": true,
                                "border-border-weak-base bg-background-stronger shadow-xs-border": pid() === item.id,
                                "border-border-weaker-base bg-surface-base": pid() !== item.id,
                              }}
                              onClick={() => {
                                setPID(item.id)
                                setParts(true)
                              }}
                            >
                              <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                  <div class="text-13-medium text-text-base">{item.name}</div>
                                  <div class="mt-1 text-12-medium text-text-weak">{item.description}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  class="h-8 px-2 text-11-medium shrink-0"
                                  onClick={(event: MouseEvent) => {
                                    event.stopPropagation()
                                    setPID(item.id)
                                    setParts(true)
                                    attach(item.id)
                                  }}
                                >
                                  Add
                                </Button>
                              </div>
                              <div class="mt-3 flex flex-wrap gap-2">
                                <For each={filesFor(cur(), item)}>
                                  {(file) => (
                                    <div class="rounded-full border border-border-weaker-base px-2 py-1 text-10-medium text-text-weak">
                                      {file.path}
                                    </div>
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
