import { useNavigate } from "@solidjs/router"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
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
  let frame: HTMLIFrameElement | undefined

  const tpl = createMemo(() => template(id()) ?? list[0])
  const hit = createMemo(() => part(tpl(), pid()) ?? tpl()?.parts[0])
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
      if (item) setPID(item.id)
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

  return (
    <div class="size-full overflow-hidden p-3">
      <div class="size-full overflow-hidden rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)] flex">
        <aside class="w-[280px] shrink-0 border-r border-border-weaker-base bg-background-stronger p-3 flex flex-col gap-3">
          <div class="rounded-[18px] border border-border-weaker-base bg-surface-base px-3 py-3">
            <div class="flex items-center gap-2">
              <div class="size-9 rounded-xl bg-background-stronger flex items-center justify-center text-icon-info-base">
                <Icon name="layout-right-full" size="small" />
              </div>
              <div class="min-w-0">
                <div class="text-10-medium uppercase tracking-[0.12em] text-text-weak">Templates</div>
                <div class="text-13-medium text-text-base truncate">Reference library</div>
              </div>
            </div>
            <div class="mt-3 text-12-medium text-text-weak">
              Attach a full starter or a curated section, then ask the assistant to adapt it into the current page.
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto space-y-2 pr-1">
            <For each={list}>
              {(item) => (
                <button
                  type="button"
                  classList={{
                    "w-full rounded-[18px] border px-3 py-3 text-left transition-colors": true,
                    "border-border-weak-base bg-surface-base-active shadow-xs-border": id() === item.id,
                    "border-border-weaker-base bg-surface-base hover:bg-surface-base-hover": id() !== item.id,
                  }}
                  onClick={() => {
                    setID(item.id)
                    setPID("full")
                    setPick(false)
                  }}
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-13-medium text-text-base">{item.name}</div>
                    <div class="rounded-full border border-border-weaker-base px-2 py-0.5 text-10-medium text-text-weak">
                      {item.stack}
                    </div>
                  </div>
                  <div class="mt-2 text-12-medium text-text-weak">{item.description}</div>
                </button>
              )}
            </For>
          </div>
        </aside>

        <Show when={tpl()}>
          {(cur) => (
            <div class="min-w-0 flex-1 bg-background-base p-3 flex flex-col gap-3 overflow-hidden">
              <div class="rounded-[18px] border border-border-weaker-base bg-surface-base px-4 py-4 flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="text-10-medium uppercase tracking-[0.12em] text-text-weak">Bundled starter</div>
                    <div class="rounded-full border border-border-weaker-base px-2 py-0.5 text-10-medium text-text-weak">
                      {cur().stack}
                    </div>
                  </div>
                  <div class="mt-2 text-20-medium text-text-base">{cur().name}</div>
                  <div class="mt-2 max-w-[780px] text-13-medium text-text-weak">{cur().description}</div>
                </div>
                <div class="shrink-0 flex items-center gap-2">
                  <Button variant="ghost" class="h-9 px-3 text-12-medium" onClick={() => attach("full")}>
                    Attach full template
                  </Button>
                  <Button class="h-9 px-3 text-12-medium" onClick={() => void create()}>
                    Create starter project
                  </Button>
                </div>
              </div>

              <div class="min-h-0 flex-1 grid grid-cols-[minmax(0,1fr)_320px] gap-3 overflow-hidden">
                <div class="min-h-0 overflow-hidden rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)]">
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
                  <div class="h-10 border-b border-border-weaker-base px-4 flex items-center justify-between gap-3 bg-background-stronger">
                    <div class="min-w-0 text-11-medium text-text-weak">
                      {pick()
                        ? "Selection mode is on. Click any highlighted element to add it to chat."
                        : "Browse the template normally. Turn on selection when you want to pick a part."}
                    </div>
                    <div class="shrink-0 text-11-medium text-text-base">
                      Selected: {hit()?.name ?? "Full template"}
                    </div>
                  </div>
                  <iframe
                    ref={frame}
                    srcdoc={cur().preview}
                    sandbox="allow-scripts allow-same-origin"
                    class="block h-[calc(100%-84px)] w-full bg-white"
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

                <div class="min-h-0 overflow-auto rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)] p-3">
                  <div class="text-10-medium uppercase tracking-[0.12em] text-text-weak">Curated parts</div>
                  <div class="mt-2 text-13-medium text-text-base">Browse first, then add the part you want</div>
                  <div class="mt-3 space-y-2">
                    <For each={cur().parts}>
                      {(item) => (
                        <div
                          classList={{
                            "rounded-[18px] border px-3 py-3 transition-colors cursor-pointer": true,
                            "border-border-weak-base bg-background-stronger shadow-xs-border": pid() === item.id,
                            "border-border-weaker-base bg-surface-base": pid() !== item.id,
                          }}
                          onClick={() => setPID(item.id)}
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
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
