import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { Tabs } from "@opencode-ai/ui/tabs"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Spinner } from "@opencode-ai/ui/spinner"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { Mark } from "@opencode-ai/ui/logo"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { useDialog } from "@opencode-ai/ui/context/dialog"

import FileTree from "@/components/file-tree"
import { SessionContextUsage } from "@/components/session-context-usage"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { Braille, getBrailleFrames, type BrailleKind } from "@/components/pendulum"
import { SessionContextTab, SortableTab, FileVisual } from "@/components/session"
import { useCommand } from "@/context/command"
import { useFile, type SelectedLineRange } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSync } from "@/context/sync"
import { createFileTabListSync } from "@/pages/session/file-tab-scroll"
import { FileTabContent } from "@/pages/session/file-tabs"
import { createOpenSessionFileTab, createSessionTabs, getTabReorderIndex, type Sizing } from "@/pages/session/helpers"
import { setSessionHandoff } from "@/pages/session/handoff"
import { useSessionLayout } from "@/pages/session/session-layout"
import { selectSpinnerLab, useSpinnerLab } from "@/pages/session/spinner-lab"

const fixedTabs = ["spinners"]
const defs = [
  { id: "current", name: "Current", note: "Existing square pulse", color: "#FFE865" },
  {
    id: "pendulum-sweep",
    name: "Pendulum Sweep",
    note: "6-char wave shimmer gliding left to right",
    kind: "pendulum" as const,
    color: "#FFE865",
    shimmer: true,
    cols: 6,
    speed: 1.8,
  },
  {
    id: "pendulum",
    name: "Pendulum",
    note: "Braille wave shimmer",
    kind: "pendulum" as const,
    color: "#FFE865",
    cols: 3,
    speed: 1,
  },
  {
    id: "pendulum-glow",
    name: "Pendulum Glow",
    note: "Slower sweep with a softer highlight",
    kind: "pendulum" as const,
    color: "#FFE865",
    fx: "opacity-55",
    shimmer: true,
    cols: 6,
    speed: 1.2,
  },
  {
    id: "compress-sweep",
    name: "Compress Sweep",
    note: "6-char shimmer that tightens as it moves",
    kind: "compress" as const,
    color: "#FFE865",
    shimmer: true,
    cols: 6,
    speed: 1.6,
  },
  {
    id: "compress",
    name: "Compress",
    note: "Tight sieve collapse",
    kind: "compress" as const,
    color: "#FFE865",
    cols: 3,
    speed: 1,
  },
  {
    id: "compress-flash",
    name: "Compress Flash",
    note: "Faster compression pass for a sharper gleam",
    kind: "compress" as const,
    color: "#FFE865",
    shimmer: true,
    cols: 6,
    speed: 2.2,
  },
  {
    id: "sort-sweep",
    name: "Sort Sweep",
    note: "6-char noisy shimmer that settles across the title",
    kind: "sort" as const,
    color: "#FFE865",
    shimmer: true,
    cols: 6,
    speed: 1.7,
  },
  {
    id: "sort",
    name: "Sort",
    note: "Noisy settle pass",
    kind: "sort" as const,
    color: "#FFE865",
    cols: 3,
    speed: 1,
  },
  {
    id: "sort-spark",
    name: "Sort Spark",
    note: "Brighter pass with more glitch energy",
    kind: "sort" as const,
    color: "#FFE865",
    shimmer: true,
    cols: 6,
    speed: 2.4,
  },
  {
    id: "pendulum-replace",
    name: "Pendulum Replace",
    note: "Braille sweep temporarily replaces title characters",
    kind: "pendulum" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 1.7,
  },
  {
    id: "compress-replace",
    name: "Compress Replace",
    note: "Compressed pass swaps letters as it crosses the title",
    kind: "compress" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 1.8,
  },
  {
    id: "sort-replace",
    name: "Sort Replace",
    note: "Noisy replacement shimmer that settles as it moves",
    kind: "sort" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 1.9,
  },
  {
    id: "pendulum-sweep-replace",
    name: "Pendulum Sweep Replace",
    note: "Wave pass swaps letters as it glides across the title",
    kind: "pendulum" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 2.1,
  },
  {
    id: "compress-flash-replace",
    name: "Compress Flash Replace",
    note: "Sharper compressed pass that temporarily rewrites the title",
    kind: "compress" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 2.3,
  },
  {
    id: "sort-spark-replace",
    name: "Sort Spark Replace",
    note: "Brighter noisy pass that replaces letters and settles them back",
    kind: "sort" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 2.4,
  },
  {
    id: "pendulum-glow-replace",
    name: "Pendulum Glow Replace",
    note: "Softer pendulum pass that swaps title letters in place",
    kind: "pendulum" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 1.4,
  },
  {
    id: "compress-sweep-replace",
    name: "Compress Sweep Replace",
    note: "Compression pass that rewrites the title as it crosses",
    kind: "compress" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 1.9,
  },
  {
    id: "sort-sweep-replace",
    name: "Sort Sweep Replace",
    note: "Settling sort pass that temporarily replaces each character",
    kind: "sort" as const,
    color: "#FFE865",
    replace: true,
    cols: 6,
    speed: 1.8,
  },
  {
    id: "pendulum-overlay",
    name: "Pendulum Overlay",
    note: "Wave pass rides directly on top of the title text",
    kind: "pendulum" as const,
    color: "#FFE865",
    overlay: true,
    cols: 6,
    speed: 1.9,
  },
  {
    id: "compress-overlay",
    name: "Compress Overlay",
    note: "Compression shimmer glides over the title without replacing it",
    kind: "compress" as const,
    color: "#FFE865",
    overlay: true,
    cols: 6,
    speed: 2,
  },
  {
    id: "sort-overlay",
    name: "Sort Overlay",
    note: "Settling sort shimmer passes over the title text",
    kind: "sort" as const,
    color: "#FFE865",
    overlay: true,
    cols: 6,
    speed: 1.8,
  },
  {
    id: "pendulum-glow-overlay",
    name: "Pendulum Glow Overlay",
    note: "Softer pendulum pass layered directly over the title",
    kind: "pendulum" as const,
    color: "#FFE865",
    overlay: true,
    cols: 6,
    speed: 1.4,
  },
  {
    id: "sort-spark-overlay",
    name: "Sort Spark Overlay",
    note: "Brighter noisy pass that floats over the title text",
    kind: "sort" as const,
    color: "#FFE865",
    overlay: true,
    cols: 6,
    speed: 2.4,
  },
  {
    id: "pendulum-frame",
    name: "Pendulum Frame",
    note: "A pendulum spinner sits before the title and fills the rest of the row after it",
    kind: "pendulum" as const,
    color: "#FFE865",
    frame: true,
    cols: 6,
    speed: 1.8,
  },
  {
    id: "compress-frame",
    name: "Compress Frame",
    note: "A compression spinner brackets the title with a long animated tail",
    kind: "compress" as const,
    color: "#FFE865",
    frame: true,
    cols: 6,
    speed: 1.9,
  },
  {
    id: "compress-tail",
    name: "Compress Tail",
    note: "A continuous compress spinner starts after the title and fills the rest of the row",
    kind: "compress" as const,
    color: "#FFE865",
    trail: true,
    cols: 6,
    speed: 1.9,
  },
  {
    id: "sort-frame",
    name: "Sort Frame",
    note: "A noisy sort spinner wraps the title with a giant animated frame",
    kind: "sort" as const,
    color: "#FFE865",
    frame: true,
    cols: 6,
    speed: 1.8,
  },
  {
    id: "square-wave",
    name: "Square Wave",
    note: "A 4-row field of tiny squares shimmers behind the entire title row",
    color: "#FFE865",
    square: true,
    speed: 1.8,
    size: 2,
    gap: 1,
    low: 0.08,
    high: 0.72,
  },
] as const

type Def = (typeof defs)[number]
type DefId = Def["id"]

const defsById = new Map(defs.map((row) => [row.id, row]))

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const adjustable = (row: Def) => "kind" in row || "square" in row
const moving = (row: Def) => "shimmer" in row || "replace" in row || "overlay" in row || "square" in row
const trailFrames = (cols: number) => {
  let s = 17
  const rnd = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
  return Array.from({ length: 120 }, () =>
    Array.from({ length: cols }, () => {
      let mask = 0
      for (let bit = 0; bit < 8; bit++) {
        if (rnd() > 0.45) mask |= 1 << bit
      }
      if (!mask) mask = 1 << Math.floor(rnd() * 8)
      return String.fromCharCode(0x2800 + mask)
    }).join(""),
  )
}

const SpinnerTitle = (props: {
  title: string
  kind: BrailleKind
  color: string
  fx?: string
  cols: number
  anim: number
  move: number
}) => {
  const [x, setX] = createSignal(-18)

  createEffect(() => {
    if (typeof window === "undefined") return
    setX(-18)
    const id = window.setInterval(() => {
      setX((x) => (x > 112 ? -18 : x + Math.max(0.5, props.move)))
    }, 32)
    onCleanup(() => window.clearInterval(id))
  })

  return (
    <div class="relative min-w-0 flex-1 overflow-hidden py-0.5">
      <div class="truncate text-14-medium text-text-strong">{props.title}</div>
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${x()}% - 6ch)` }}>
          <Braille
            kind={props.kind}
            cols={props.cols}
            rate={props.anim}
            class={`inline-flex items-center justify-center overflow-hidden font-mono text-[12px] leading-none font-semibold opacity-80 drop-shadow-[0_0_10px_currentColor] select-none ${props.fx ?? ""}`}
            style={{ color: props.color }}
          />
        </div>
      </div>
    </div>
  )
}

const ReplaceTitle = (props: {
  title: string
  kind: BrailleKind
  color: string
  cols: number
  anim: number
  move: number
}) => {
  const chars = createMemo(() => Array.from(props.title))
  const frames = createMemo(() => getBrailleFrames(props.kind, props.cols).map((frame) => Array.from(frame)))
  const [state, setState] = createStore({ pos: 0, idx: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ pos: 0, idx: 0 })
    const anim = window.setInterval(
      () => {
        setState("idx", (idx) => (idx + 1) % frames().length)
      },
      Math.max(16, Math.round(42 / Math.max(0.4, props.anim))),
    )
    const slide = window.setInterval(
      () => {
        setState("pos", (pos) => (pos >= chars().length - 1 ? 0 : pos + 1))
      },
      Math.max(90, Math.round(260 / Math.max(0.4, props.move))),
    )
    onCleanup(() => {
      window.clearInterval(anim)
      window.clearInterval(slide)
    })
  })

  return (
    <div class="min-w-0 flex-1 overflow-hidden py-0.5">
      <div class="truncate whitespace-nowrap font-mono text-[13px] font-semibold text-text-strong">
        <For each={chars()}>
          {(char, idx) => {
            const offset = () => idx() - state.pos
            const active = () => offset() >= 0 && offset() < props.cols
            const next = () => (active() ? (frames()[state.idx][offset()] ?? char) : char)
            return (
              <span classList={{ "text-[12px]": active() }} style={{ color: active() ? props.color : undefined }}>
                {next()}
              </span>
            )
          }}
        </For>
      </div>
    </div>
  )
}

const OverlayTitle = (props: {
  title: string
  kind: BrailleKind
  color: string
  cols: number
  anim: number
  move: number
}) => {
  let root: HTMLDivElement | undefined
  let fx: HTMLDivElement | undefined
  const [state, setState] = createStore({ pos: 0, max: 0, dark: false })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ pos: 0 })
    const id = window.setInterval(
      () => setState("pos", (pos) => (pos >= state.max ? 0 : Math.min(state.max, pos + 8))),
      Math.max(90, Math.round(260 / Math.max(0.4, props.move))),
    )
    onCleanup(() => window.clearInterval(id))
  })

  createEffect(() => {
    if (typeof window === "undefined") return
    if (!root || !fx) return
    const sync = () => setState("max", Math.max(0, root!.clientWidth - fx!.clientWidth))
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(root)
    observer.observe(fx)
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    if (typeof window === "undefined") return
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => setState("dark", query.matches)
    sync()
    query.addEventListener("change", sync)
    onCleanup(() => query.removeEventListener("change", sync))
  })

  return (
    <div ref={root} class="relative min-w-0 flex-1 overflow-hidden py-0.5">
      <div class="truncate whitespace-nowrap text-14-medium text-text-strong">{props.title}</div>
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div ref={fx} class="absolute top-1/2 -translate-y-1/2" style={{ left: `${state.pos}px` }}>
          <Braille
            kind={props.kind}
            cols={props.cols}
            rate={props.anim}
            class="inline-flex items-center justify-center overflow-hidden rounded-sm px-0.5 py-2 font-mono text-[12px] leading-none font-semibold select-none"
            style={{ color: props.color, "background-color": state.dark ? "#151515" : "#FCFCFC" }}
          />
        </div>
      </div>
    </div>
  )
}

const FrameTitle = (props: { title: string; kind: BrailleKind; color: string; cols: number; anim: number }) => {
  const head = createMemo(() => getBrailleFrames(props.kind, props.cols))
  const tail = createMemo(() => getBrailleFrames(props.kind, 64))
  const [state, setState] = createStore({ idx: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ idx: 0 })
    const id = window.setInterval(
      () => {
        setState("idx", (idx) => (idx + 1) % head().length)
      },
      Math.max(16, Math.round(42 / Math.max(0.4, props.anim))),
    )
    onCleanup(() => window.clearInterval(id))
  })

  const left = createMemo(() => head()[state.idx] ?? "")
  const right = createMemo(() => tail()[state.idx] ?? "")

  return (
    <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-0.5">
      <div class="shrink-0 font-mono text-[12px] font-semibold leading-none" style={{ color: props.color }}>
        {left()}
      </div>
      <div class="shrink-0 truncate text-14-medium text-text-strong">{props.title}</div>
      <div
        class="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-mono text-[12px] font-semibold leading-none"
        style={{ color: props.color }}
      >
        {right()}
      </div>
    </div>
  )
}

const TrailTitle = (props: { title: string; kind: BrailleKind; color: string; cols: number; anim: number }) => {
  const tail = createMemo(() => trailFrames(Math.max(24, props.cols * 12)))
  const [state, setState] = createStore({ idx: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ idx: 0 })
    const id = window.setInterval(
      () => {
        setState("idx", (idx) => (idx + 1) % tail().length)
      },
      Math.max(16, Math.round(42 / Math.max(0.4, props.anim))),
    )
    onCleanup(() => window.clearInterval(id))
  })

  return (
    <div class="flex w-full min-w-0 flex-1 items-center gap-2 overflow-hidden py-0.5">
      <div class="min-w-0 max-w-[55%] flex-[0_1_auto] truncate text-14-medium text-text-strong">{props.title}</div>
      <div
        class="min-w-[10ch] basis-0 flex-[1_1_0%] overflow-hidden whitespace-nowrap font-mono text-[12px] font-semibold leading-none"
        style={{ color: props.color }}
      >
        {tail()[state.idx] ?? ""}
      </div>
    </div>
  )
}

const SquareWaveTitle = (props: {
  title: string
  color: string
  anim: number
  move: number
  size: number
  gap: number
  low: number
  high: number
}) => {
  const cols = createMemo(() => Math.max(96, Math.ceil(Array.from(props.title).length * 4.5)))
  const cells = createMemo(() =>
    Array.from({ length: cols() * 4 }, (_, idx) => ({
      row: Math.floor(idx / cols()),
      col: idx % cols(),
    })),
  )
  const [state, setState] = createStore({ pos: 0, phase: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ pos: 0, phase: 0 })
    const anim = window.setInterval(
      () => {
        setState("phase", (phase) => phase + 0.45)
      },
      Math.max(16, Math.round(44 / Math.max(0.4, props.anim))),
    )
    const slide = window.setInterval(
      () => {
        setState("pos", (pos) => (pos >= cols() + 10 ? 0 : pos + 1))
      },
      Math.max(40, Math.round(160 / Math.max(0.4, props.move))),
    )
    onCleanup(() => {
      window.clearInterval(anim)
      window.clearInterval(slide)
    })
  })

  return (
    <div class="relative min-w-0 flex-1 overflow-hidden py-2">
      <div
        class="pointer-events-none absolute inset-0 grid content-center overflow-hidden"
        aria-hidden="true"
        style={{
          "grid-template-columns": `repeat(${cols()}, ${props.size}px)`,
          "grid-auto-rows": `${props.size}px`,
          gap: `${props.gap}px`,
        }}
      >
        <For each={cells()}>
          {(cell) => {
            const opacity = () => {
              const wave = (Math.cos((cell.col - state.pos) * 0.32 - state.phase + cell.row * 0.55) + 1) / 2
              return props.low + (props.high - props.low) * wave * wave
            }

            return (
              <div
                style={{
                  width: `${props.size}px`,
                  height: `${props.size}px`,
                  "background-color": props.color,
                  opacity: `${opacity()}`,
                }}
              />
            )
          }}
        </For>
      </div>
      <div class="relative z-10 truncate px-2 text-14-medium text-text-strong">
        <span class="bg-background-stronger">{props.title}</span>
      </div>
    </div>
  )
}

const SpinnerConcept = (props: {
  row: Def
  order: JSX.Element
  controls: JSX.Element
  children: JSX.Element
  active: boolean
  color: string
  onSelect: () => void
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={props.onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        props.onSelect()
      }}
      class="w-full rounded-lg border border-border-weaker-base bg-background-stronger px-3 py-3 text-left transition-colors"
      classList={{
        "border-border-strong-base": props.active,
      }}
    >
      <div class="flex min-w-0 items-center gap-3 px-3 py-2">
        <div class="flex min-w-0 flex-1 items-center gap-3">{props.children}</div>
        <Show when={props.active}>
          <div class="shrink-0">
            <Icon name="check" size="small" style={{ color: props.color }} />
          </div>
        </Show>
        <div class="shrink-0">{props.order}</div>
        <div class="ml-auto shrink-0">{props.controls}</div>
      </div>
    </div>
  )
}

export function SessionSidePanel(props: {
  reviewPanel: () => JSX.Element
  activeDiff?: string
  focusReviewDiff: (path: string) => void
  reviewSnap: boolean
  size: Sizing
}) {
  const layout = useLayout()
  const sync = useSync()
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const dialog = useDialog()
  const spinnerLab = useSpinnerLab()
  const { params, sessionKey, tabs, view } = useSessionLayout()

  const isDesktop = createMediaQuery("(min-width: 768px)")

  const reviewOpen = createMemo(() => isDesktop() && view().reviewPanel.opened())
  const fileOpen = createMemo(() => isDesktop() && layout.fileTree.opened())
  const open = createMemo(() => reviewOpen() || fileOpen())
  const reviewTab = createMemo(() => isDesktop())
  const fixed = () => fixedTabs
  const panelWidth = createMemo(() => {
    if (!open()) return "0px"
    if (reviewOpen()) return `calc(100% - ${layout.session.width()}px)`
    return `${layout.fileTree.width()}px`
  })
  const treeWidth = createMemo(() => (fileOpen() ? `${layout.fileTree.width()}px` : "0px"))

  const info = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const diffs = createMemo(() => (params.id ? (sync.data.session_diff[params.id] ?? []) : []))
  const reviewCount = createMemo(() => Math.max(info()?.summary?.files ?? 0, diffs().length))
  const hasReview = createMemo(() => reviewCount() > 0)
  const diffsReady = createMemo(() => {
    const id = params.id
    if (!id) return true
    if (!hasReview()) return true
    return sync.data.session_diff[id] !== undefined
  })

  const reviewEmptyKey = createMemo(() => {
    if (sync.project && !sync.project.vcs) return "session.review.noVcs"
    if (sync.data.config.snapshot === false) return "session.review.noSnapshot"
    return "session.review.noChanges"
  })
  const title = createMemo(() => info()?.title?.trim() || language.t("command.session.new"))
  const [spinner, setSpinner] = createStore({
    order: defs.map((row) => row.id) as DefId[],
  })

  const diffFiles = createMemo(() => diffs().map((d) => d.file))
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }

    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")

    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs()) {
      const file = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

      out.set(file, kind)

      const parts = file.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const empty = (msg: string) => (
    <div class="h-full flex flex-col">
      <div class="h-6 shrink-0" aria-hidden />
      <div class="flex-1 pb-64 flex items-center justify-center text-center">
        <div class="text-12-regular text-text-weak">{msg}</div>
      </div>
    </div>
  )

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const normalizeTab = (tab: string) => {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  const openReviewPanel = () => {
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
  }

  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel,
    setActive: tabs().setActive,
  })

  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab,
    review: reviewTab,
    hasReview,
    fixed,
  })
  const contextOpen = tabState.contextOpen
  const openedTabs = tabState.openedTabs
  const activeTab = tabState.activeTab
  const activeFileTab = tabState.activeFileTab

  const spinnerPanel = () => {
    const rows = createMemo(() => spinner.order.map((id) => defsById.get(id)).filter((row) => row !== undefined))
    const preview = (name: string) => `${title()} with ${name}`
    const move = (from: DefId, to: DefId) => {
      if (from === to) return
      const order = [...spinner.order]
      const fromIdx = order.indexOf(from)
      const toIdx = order.indexOf(to)
      if (fromIdx === -1 || toIdx === -1) return
      const [row] = order.splice(fromIdx, 1)
      order.splice(toIdx, 0, row)
      setSpinner("order", order)
    }
    const shift = (id: DefId, delta: -1 | 1) => {
      const idx = spinner.order.indexOf(id)
      const next = idx + delta
      if (idx === -1 || next < 0 || next >= spinner.order.length) return
      const order = [...spinner.order]
      const [row] = order.splice(idx, 1)
      order.splice(next, 0, row)
      setSpinner("order", order)
    }
    const order = (row: Def, idx: number) => (
      <div class="flex items-center gap-1">
        <IconButton
          icon="arrow-up"
          variant="ghost"
          class="h-6 w-6"
          onPointerDown={(event: PointerEvent) => event.stopPropagation()}
          onClick={(event: MouseEvent) => {
            event.stopPropagation()
            shift(row.id, -1)
          }}
          disabled={idx === 0}
          aria-label={`Move ${row.name} up`}
        />
        <IconButton
          icon="arrow-down-to-line"
          variant="ghost"
          class="h-6 w-6"
          onPointerDown={(event: PointerEvent) => event.stopPropagation()}
          onClick={(event: MouseEvent) => {
            event.stopPropagation()
            shift(row.id, 1)
          }}
          disabled={idx === spinner.order.length - 1}
          aria-label={`Move ${row.name} down`}
        />
      </div>
    )
    const controls = (row: Def, idx: number) => (
      <DropdownMenu gutter={6} placement="bottom-end" modal={false}>
        <DropdownMenu.Trigger
          as={IconButton}
          icon="sliders"
          variant="ghost"
          class="size-6 rounded-md data-[expanded]:bg-surface-base-active"
          aria-label={`${row.name} settings`}
          onPointerDown={(event: PointerEvent) => event.stopPropagation()}
          onClick={(event: MouseEvent) => event.stopPropagation()}
        />
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="w-52 p-2">
            <div class="flex flex-col gap-2">
              {"kind" in row && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Chars</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].cols}</div>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="1"
                    value={spinnerLab.tune[row.id].cols}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "cols", Number(event.currentTarget.value))}
                    aria-label={`${row.name} characters`}
                  />
                </label>
              )}
              {adjustable(row) && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Animate</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].anim.toFixed(1)}</div>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="12"
                    step="0.1"
                    value={spinnerLab.tune[row.id].anim}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "anim", Number(event.currentTarget.value))}
                    aria-label={`${row.name} animation speed`}
                  />
                </label>
              )}
              {adjustable(row) && moving(row) && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Move</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].move.toFixed(1)}</div>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="12"
                    step="0.1"
                    value={spinnerLab.tune[row.id].move}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "move", Number(event.currentTarget.value))}
                    aria-label={`${row.name} movement speed`}
                  />
                </label>
              )}
              {"square" in row && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Square</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].size}px</div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={spinnerLab.tune[row.id].size}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "size", Number(event.currentTarget.value))}
                    aria-label={`${row.name} square size`}
                  />
                </label>
              )}
              {"square" in row && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Gap</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].gap}px</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={spinnerLab.tune[row.id].gap}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "gap", Number(event.currentTarget.value))}
                    aria-label={`${row.name} square gap`}
                  />
                </label>
              )}
              {"square" in row && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Base</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].low.toFixed(2)}</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.6"
                    step="0.01"
                    value={spinnerLab.tune[row.id].low}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "low", Number(event.currentTarget.value))}
                    aria-label={`${row.name} base opacity`}
                  />
                </label>
              )}
              {"square" in row && (
                <label class="flex flex-col gap-1 rounded-md border border-border-weaker-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div class="text-11-regular text-text-weaker">Peak</div>
                    <div class="text-11-regular text-text-strong">{spinnerLab.tune[row.id].high.toFixed(2)}</div>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.01"
                    value={spinnerLab.tune[row.id].high}
                    class="w-full"
                    onInput={(event) => spinnerLab.setTune(row.id, "high", Number(event.currentTarget.value))}
                    aria-label={`${row.name} peak opacity`}
                  />
                </label>
              )}
              <label class="flex items-center gap-2 rounded-md border border-border-weaker-base px-2 py-1">
                <div class="text-11-regular text-text-weaker">Color</div>
                <input
                  type="color"
                  value={spinnerLab.tune[row.id].color}
                  class="ml-auto h-5 w-7 cursor-pointer rounded border-none bg-transparent p-0"
                  onInput={(event) => spinnerLab.setTune(row.id, "color", event.currentTarget.value)}
                  aria-label={`${row.name} color`}
                />
              </label>
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    )

    return (
      <div class="flex h-full min-h-0 flex-col bg-background-base">
        <div class="border-b border-border-weaker-base px-4 py-3">
          <div class="text-13-medium text-text-strong">Spinner concepts</div>
          <div class="mt-1 text-12-regular text-text-weak">
            Current session title with adjustable loading treatments.
          </div>
          <div class="mt-1 text-11-regular text-text-weaker">
            Click a concept to try it in the session header. Use the arrows beside each concept to reorder the list.
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-[200px]">
          <div class="flex flex-col gap-2">
            <For each={rows()}>
              {(row, idx) => (
                <SpinnerConcept
                  row={row}
                  order={order(row, idx())}
                  controls={controls(row, idx())}
                  active={spinnerLab.isActive(row.id)}
                  color={spinnerLab.tune[row.id].color}
                  onSelect={() => selectSpinnerLab(row.id)}
                >
                  {"square" in row ? (
                    <SquareWaveTitle
                      title={preview(row.name)}
                      color={spinnerLab.tune[row.id].color}
                      anim={spinnerLab.tune[row.id].anim}
                      move={spinnerLab.tune[row.id].move}
                      size={spinnerLab.tune[row.id].size}
                      gap={spinnerLab.tune[row.id].gap}
                      low={Math.min(spinnerLab.tune[row.id].low, spinnerLab.tune[row.id].high - 0.05)}
                      high={Math.max(spinnerLab.tune[row.id].high, spinnerLab.tune[row.id].low + 0.05)}
                    />
                  ) : "kind" in row ? (
                    "replace" in row ? (
                      <ReplaceTitle
                        title={preview(row.name)}
                        kind={row.kind}
                        cols={spinnerLab.tune[row.id].cols}
                        anim={spinnerLab.tune[row.id].anim}
                        move={spinnerLab.tune[row.id].move}
                        color={spinnerLab.tune[row.id].color}
                      />
                    ) : "trail" in row ? (
                      <TrailTitle
                        title={preview(row.name)}
                        kind={row.kind}
                        cols={spinnerLab.tune[row.id].cols}
                        anim={spinnerLab.tune[row.id].anim}
                        color={spinnerLab.tune[row.id].color}
                      />
                    ) : "frame" in row ? (
                      <FrameTitle
                        title={preview(row.name)}
                        kind={row.kind}
                        cols={spinnerLab.tune[row.id].cols}
                        anim={spinnerLab.tune[row.id].anim}
                        color={spinnerLab.tune[row.id].color}
                      />
                    ) : "overlay" in row ? (
                      <OverlayTitle
                        title={preview(row.name)}
                        kind={row.kind}
                        cols={spinnerLab.tune[row.id].cols}
                        anim={spinnerLab.tune[row.id].anim}
                        move={spinnerLab.tune[row.id].move}
                        color={spinnerLab.tune[row.id].color}
                      />
                    ) : "shimmer" in row ? (
                      <SpinnerTitle
                        title={preview(row.name)}
                        kind={row.kind}
                        cols={spinnerLab.tune[row.id].cols}
                        anim={spinnerLab.tune[row.id].anim}
                        move={spinnerLab.tune[row.id].move}
                        color={spinnerLab.tune[row.id].color}
                        fx={"fx" in row ? row.fx : undefined}
                      />
                    ) : (
                      <>
                        <div class="flex h-6 w-6 shrink-0 items-center justify-center">
                          <Braille
                            kind={row.kind}
                            cols={spinnerLab.tune[row.id].cols}
                            rate={spinnerLab.tune[row.id].anim}
                            class="inline-flex w-5 items-center justify-center overflow-hidden font-mono text-[11px] leading-none font-semibold select-none"
                            style={{ color: spinnerLab.tune[row.id].color }}
                          />
                        </div>
                        <div class="min-w-0 truncate text-14-medium text-text-strong">{preview(row.name)}</div>
                      </>
                    )
                  ) : (
                    <>
                      <div class="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Spinner class="size-4" style={{ color: spinnerLab.tune[row.id].color }} />
                      </div>
                      <div class="min-w-0 truncate text-14-medium text-text-strong">{preview(row.name)}</div>
                    </>
                  )}
                </SpinnerConcept>
              )}
            </For>
          </div>
        </div>
      </div>
    )
  }

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  const showAllFiles = () => {
    if (fileTreeTab() !== "changes") return
    layout.fileTree.setTab("all")
  }

  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
  })

  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return
    const from = draggable.id.toString()
    const to = droppable.id.toString()

    const currentTabs = tabs().all()
    const toIndex = getTabReorderIndex(currentTabs, from, to)
    if (toIndex === undefined) return
    tabs().move(from, toIndex)
  }

  const handleDragEnd = () => {
    setStore("activeDraggable", undefined)
  }

  createEffect(() => {
    if (!file.ready()) return

    setSessionHandoff(sessionKey(), {
      files: tabs()
        .all()
        .reduce<Record<string, SelectedLineRange | null>>((acc, tab) => {
          const path = file.pathFromTab(tab)
          if (!path) return acc

          const selected = file.selectedLines(path)
          acc[path] =
            selected && typeof selected === "object" && "start" in selected && "end" in selected
              ? (selected as SelectedLineRange)
              : null

          return acc
        }, {}),
    })
  })

  return (
    <Show when={isDesktop()}>
      <aside
        id="review-panel"
        aria-label={language.t("session.panel.reviewAndFiles")}
        aria-hidden={!open()}
        inert={!open()}
        class="relative min-w-0 h-full flex shrink-0 overflow-hidden bg-background-base"
        classList={{
          "pointer-events-none": !open(),
          "transition-[width] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
            !props.size.active() && !props.reviewSnap,
        }}
        style={{ width: panelWidth() }}
      >
        <div class="size-full flex border-l border-border-weaker-base">
          <div
            aria-hidden={!reviewOpen()}
            inert={!reviewOpen()}
            class="relative min-w-0 h-full flex-1 overflow-hidden bg-background-base"
            classList={{
              "pointer-events-none": !reviewOpen(),
            }}
          >
            <div class="size-full min-w-0 h-full bg-background-base">
              <Tabs value={activeTab()} onChange={openTab}>
                <div class="sticky top-0 shrink-0 flex">
                  <DragDropProvider
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    collisionDetector={closestCenter}
                  >
                    <DragDropSensors />
                    <ConstrainDragYAxis />
                    <Tabs.List
                      ref={(el: HTMLDivElement) => {
                        const stop = createFileTabListSync({ el, contextOpen })
                        onCleanup(stop)
                      }}
                    >
                      <Show when={reviewTab()}>
                        <Tabs.Trigger value="review">
                          <div class="flex items-center gap-1.5">
                            <div>{language.t("session.tab.review")}</div>
                            <Show when={hasReview()}>
                              <div>{reviewCount()}</div>
                            </Show>
                          </div>
                        </Tabs.Trigger>
                      </Show>
                      <Tabs.Trigger value="spinners">
                        <div>Spinners</div>
                      </Tabs.Trigger>
                      <Show when={contextOpen()}>
                        <Tabs.Trigger
                          value="context"
                          closeButton={
                            <TooltipKeybind
                              title={language.t("common.closeTab")}
                              keybind={command.keybind("tab.close")}
                              placement="bottom"
                              gutter={10}
                            >
                              <IconButton
                                icon="close-small"
                                variant="ghost"
                                class="h-5 w-5"
                                onClick={() => tabs().close("context")}
                                aria-label={language.t("common.closeTab")}
                              />
                            </TooltipKeybind>
                          }
                          hideCloseButton
                          onMiddleClick={() => tabs().close("context")}
                        >
                          <div class="flex items-center gap-2">
                            <SessionContextUsage variant="indicator" />
                            <div>{language.t("session.tab.context")}</div>
                          </div>
                        </Tabs.Trigger>
                      </Show>
                      <SortableProvider ids={openedTabs()}>
                        <For each={openedTabs()}>{(tab) => <SortableTab tab={tab} onTabClose={tabs().close} />}</For>
                      </SortableProvider>
                      <div class="bg-background-stronger h-full shrink-0 sticky right-0 z-10 flex items-center justify-center pr-3">
                        <TooltipKeybind
                          title={language.t("command.file.open")}
                          keybind={command.keybind("file.open")}
                          class="flex items-center"
                        >
                          <IconButton
                            icon="plus-small"
                            variant="ghost"
                            iconSize="large"
                            class="!rounded-md"
                            onClick={() =>
                              dialog.show(() => <DialogSelectFile mode="files" onOpenFile={showAllFiles} />)
                            }
                            aria-label={language.t("command.file.open")}
                          />
                        </TooltipKeybind>
                      </div>
                    </Tabs.List>
                    <DragOverlay>
                      <Show when={store.activeDraggable} keyed>
                        {(tab) => {
                          const path = file.pathFromTab(tab)
                          return (
                            <div data-component="tabs-drag-preview">
                              <Show when={path}>{(p) => <FileVisual active path={p()} />}</Show>
                            </div>
                          )
                        }}
                      </Show>
                    </DragOverlay>
                  </DragDropProvider>
                </div>

                <Show when={reviewTab()}>
                  <Tabs.Content value="review" class="flex flex-col h-full overflow-hidden contain-strict">
                    <Show when={activeTab() === "review"}>{props.reviewPanel()}</Show>
                  </Tabs.Content>
                </Show>

                <Tabs.Content value="spinners" class="flex flex-col h-full overflow-hidden contain-strict">
                  <Show when={activeTab() === "spinners"}>{spinnerPanel()}</Show>
                </Tabs.Content>

                <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                  <Show when={activeTab() === "empty"}>
                    <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                      <div class="h-full px-6 pb-42 -mt-4 flex flex-col items-center justify-center text-center gap-6">
                        <Mark class="w-14 opacity-10" />
                        <div class="text-14-regular text-text-weak max-w-56">
                          {language.t("session.files.selectToOpen")}
                        </div>
                      </div>
                    </div>
                  </Show>
                </Tabs.Content>

                <Show when={contextOpen()}>
                  <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                    <Show when={activeTab() === "context"}>
                      <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                        <SessionContextTab />
                      </div>
                    </Show>
                  </Tabs.Content>
                </Show>

                <Show when={activeFileTab()} keyed>
                  {(tab) => <FileTabContent tab={tab} />}
                </Show>
              </Tabs>
            </div>
          </div>

          <div
            id="file-tree-panel"
            aria-hidden={!fileOpen()}
            inert={!fileOpen()}
            class="relative min-w-0 h-full shrink-0 overflow-hidden"
            classList={{
              "pointer-events-none": !fileOpen(),
              "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
                !props.size.active(),
            }}
            style={{ width: treeWidth() }}
          >
            <div
              class="h-full flex flex-col overflow-hidden group/filetree"
              classList={{ "border-l border-border-weaker-base": reviewOpen() }}
            >
              <Tabs
                variant="pill"
                value={fileTreeTab()}
                onChange={setFileTreeTabValue}
                class="h-full"
                data-scope="filetree"
              >
                <Tabs.List>
                  <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                    {reviewCount()}{" "}
                    {language.t(reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other")}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                    {language.t("session.files.all")}
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0">
                  <Switch>
                    <Match when={hasReview()}>
                      <Show
                        when={diffsReady()}
                        fallback={
                          <div class="px-2 py-2 text-12-regular text-text-weak">
                            {language.t("common.loading")}
                            {language.t("common.loading.ellipsis")}
                          </div>
                        }
                      >
                        <FileTree
                          path=""
                          class="pt-3"
                          allowed={diffFiles()}
                          kinds={kinds()}
                          draggable={false}
                          active={props.activeDiff}
                          onFileClick={(node) => props.focusReviewDiff(node.path)}
                        />
                      </Show>
                    </Match>
                    <Match when={true}>
                      {empty(
                        language.t(sync.project && !sync.project.vcs ? "session.review.noChanges" : reviewEmptyKey()),
                      )}
                    </Match>
                  </Switch>
                </Tabs.Content>
                <Tabs.Content value="all" class="bg-background-stronger px-3 py-0">
                  <Switch>
                    <Match when={nofiles()}>{empty(language.t("session.files.empty"))}</Match>
                    <Match when={true}>
                      <FileTree
                        path=""
                        class="pt-3"
                        modified={diffFiles()}
                        kinds={kinds()}
                        onFileClick={(node) => openTab(file.tab(node.path))}
                      />
                    </Match>
                  </Switch>
                </Tabs.Content>
              </Tabs>
            </div>
            <Show when={fileOpen()}>
              <div onPointerDown={() => props.size.start()}>
                <ResizeHandle
                  direction="horizontal"
                  edge="start"
                  size={layout.fileTree.width()}
                  min={200}
                  max={480}
                  onResize={(width) => {
                    props.size.touch()
                    layout.fileTree.resize(width)
                  }}
                />
              </div>
            </Show>
          </div>
        </div>
      </aside>
    </Show>
  )
}
