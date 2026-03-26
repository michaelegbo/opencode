import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Braille, getBrailleFrames, type BrailleKind } from "@/components/pendulum"

export const spinnerLabIds = [
  "current",
  "pendulum-sweep",
  "pendulum",
  "pendulum-glow",
  "compress-sweep",
  "compress",
  "compress-flash",
  "sort-sweep",
  "sort",
  "sort-spark",
  "pendulum-replace",
  "compress-replace",
  "sort-replace",
  "pendulum-sweep-replace",
  "compress-flash-replace",
  "sort-spark-replace",
  "pendulum-glow-replace",
  "compress-sweep-replace",
  "sort-sweep-replace",
  "pendulum-overlay",
  "compress-overlay",
  "sort-overlay",
  "pendulum-glow-overlay",
  "sort-spark-overlay",
  "pendulum-frame",
  "compress-frame",
  "compress-tail",
  "sort-frame",
  "square-wave",
] as const

export type SpinnerLabId = (typeof spinnerLabIds)[number]

const ids = new Set<string>(spinnerLabIds)
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

const parse = (id: SpinnerLabId) => {
  const kind: BrailleKind | undefined = id.startsWith("pendulum")
    ? "pendulum"
    : id.startsWith("compress")
      ? "compress"
      : id.startsWith("sort")
        ? "sort"
        : undefined
  const mode =
    id === "current"
      ? "current"
      : id === "square-wave"
        ? "square"
        : id.endsWith("-tail")
          ? "trail"
          : id.endsWith("-replace")
            ? "replace"
            : id.endsWith("-overlay")
              ? "overlay"
              : id.endsWith("-frame")
                ? "frame"
                : id === "pendulum" || id === "compress" || id === "sort"
                  ? "spin"
                  : "shimmer"
  const anim = id.includes("glow")
    ? 1.4
    : id.includes("flash") || id.includes("spark")
      ? 2.4
      : id.includes("sweep")
        ? 1.9
        : 1.8
  const move = mode === "spin" || mode === "current" ? 1 : anim
  return {
    id,
    mode,
    kind,
    cols: mode === "spin" ? 3 : 6,
    anim,
    move,
    color: "#FFE865",
    size: 2,
    gap: 1,
    low: 0.08,
    high: 0.72,
  }
}

type SpinnerLabTune = ReturnType<typeof parse>

const defaults = Object.fromEntries(spinnerLabIds.map((id) => [id, parse(id)])) as Record<SpinnerLabId, SpinnerLabTune>
const [lab, setLab] = createStore({ active: "pendulum" as SpinnerLabId, tune: defaults })

const mask = (title: string, fill: string, pos: number) =>
  Array.from(title)
    .map((char, idx) => {
      const off = idx - pos
      if (off < 0 || off >= fill.length) return char
      return fill[off] ?? char
    })
    .join("")

const Shimmer = (props: {
  title: string
  kind: BrailleKind
  cols: number
  anim: number
  move: number
  color: string
}) => {
  const [x, setX] = createSignal(-18)
  createEffect(() => {
    if (typeof window === "undefined") return
    setX(-18)
    const id = window.setInterval(() => setX((x) => (x > 112 ? -18 : x + Math.max(0.5, props.move))), 32)
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
            class="inline-flex items-center justify-center overflow-hidden font-mono text-[12px] leading-none font-semibold opacity-80 select-none"
            style={{ color: props.color }}
          />
        </div>
      </div>
    </div>
  )
}

const Replace = (props: {
  title: string
  kind: BrailleKind
  cols: number
  anim: number
  move: number
  color: string
}) => {
  const chars = createMemo(() => Array.from(props.title))
  const frames = createMemo(() => getBrailleFrames(props.kind, props.cols))
  const [state, setState] = createStore({ pos: 0, idx: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ pos: 0, idx: 0 })
    const anim = window.setInterval(
      () => setState("idx", (idx) => (idx + 1) % frames().length),
      Math.max(16, Math.round(42 / Math.max(0.4, props.anim))),
    )
    const move = window.setInterval(
      () => setState("pos", (pos) => (pos >= chars().length - 1 ? 0 : pos + 1)),
      Math.max(90, Math.round(260 / Math.max(0.4, props.move))),
    )
    onCleanup(() => {
      window.clearInterval(anim)
      window.clearInterval(move)
    })
  })

  return (
    <div class="min-w-0 truncate whitespace-nowrap font-mono text-[13px] font-semibold text-text-strong">
      {mask(props.title, frames()[state.idx] ?? "", state.pos)}
    </div>
  )
}

const Overlay = (props: {
  title: string
  kind: BrailleKind
  cols: number
  anim: number
  move: number
  color: string
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
      <div class="truncate text-14-medium text-text-strong">{props.title}</div>
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

const Frame = (props: { title: string; kind: BrailleKind; cols: number; anim: number; color: string }) => {
  const head = createMemo(() => getBrailleFrames(props.kind, props.cols))
  const tail = createMemo(() => getBrailleFrames(props.kind, 64))
  const [state, setState] = createStore({ idx: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ idx: 0 })
    const id = window.setInterval(
      () => setState("idx", (idx) => (idx + 1) % head().length),
      Math.max(16, Math.round(42 / Math.max(0.4, props.anim))),
    )
    onCleanup(() => window.clearInterval(id))
  })

  return (
    <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-0.5">
      <div class="shrink-0 font-mono text-[12px] font-semibold leading-none" style={{ color: props.color }}>
        {head()[state.idx] ?? ""}
      </div>
      <div class="shrink-0 truncate text-14-medium text-text-strong">{props.title}</div>
      <div
        class="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-mono text-[12px] font-semibold leading-none"
        style={{ color: props.color }}
      >
        {tail()[state.idx] ?? ""}
      </div>
    </div>
  )
}

const Trail = (props: { title: string; kind: BrailleKind; cols: number; anim: number; color: string }) => {
  const tail = createMemo(() => trailFrames(Math.max(24, props.cols * 12)))
  const [state, setState] = createStore({ idx: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ idx: 0 })
    const id = window.setInterval(
      () => setState("idx", (idx) => (idx + 1) % tail().length),
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

const Square = (props: {
  title: string
  anim: number
  move: number
  color: string
  size: number
  gap: number
  low: number
  high: number
}) => {
  const cols = createMemo(() => Math.max(96, Math.ceil(Array.from(props.title).length * 4.5)))
  const cells = createMemo(() =>
    Array.from({ length: cols() * 4 }, (_, idx) => ({ row: Math.floor(idx / cols()), col: idx % cols() })),
  )
  const [state, setState] = createStore({ pos: 0, phase: 0 })

  createEffect(() => {
    if (typeof window === "undefined") return
    setState({ pos: 0, phase: 0 })
    const anim = window.setInterval(
      () => setState("phase", (phase) => phase + 0.45),
      Math.max(16, Math.round(44 / Math.max(0.4, props.anim))),
    )
    const move = window.setInterval(
      () => setState("pos", (pos) => (pos >= cols() + 10 ? 0 : pos + 1)),
      Math.max(40, Math.round(160 / Math.max(0.4, props.move))),
    )
    onCleanup(() => {
      window.clearInterval(anim)
      window.clearInterval(move)
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

export const selectSpinnerLab = (id: string) => {
  if (!ids.has(id)) return
  setLab("active", id as SpinnerLabId)
}

export const useSpinnerLab = () => ({
  active: () => lab.active,
  isActive: (id: string) => lab.active === id,
  tune: lab.tune,
  config: (id: SpinnerLabId) => lab.tune[id],
  current: () => lab.tune[lab.active],
  setTune: <K extends keyof SpinnerLabTune>(id: SpinnerLabId, key: K, value: SpinnerLabTune[K]) =>
    setLab("tune", id, key, value),
})

export function SpinnerLabHeader(props: { title: string; tint?: string; class?: string }) {
  const cfg = createMemo(() => lab.tune[lab.active])
  const body = createMemo<JSX.Element>(() => {
    const cur = cfg()

    if (cur.mode === "current") {
      return (
        <div class="flex min-w-0 items-center gap-2">
          <Spinner class="size-4" style={{ color: props.tint ?? cur.color }} />
          <div class="min-w-0 truncate text-14-medium text-text-strong">{props.title}</div>
        </div>
      )
    }

    if (cur.mode === "spin" && cur.kind) {
      return (
        <div class="flex min-w-0 items-center gap-2">
          <Braille
            kind={cur.kind}
            cols={cur.cols}
            rate={cur.anim}
            class="inline-flex w-4 items-center justify-center overflow-hidden font-mono text-[9px] leading-none select-none"
            style={{ color: cur.color }}
          />
          <div class="min-w-0 truncate text-14-medium text-text-strong">{props.title}</div>
        </div>
      )
    }

    if (cur.mode === "shimmer" && cur.kind) {
      return (
        <Shimmer
          title={props.title}
          kind={cur.kind}
          cols={cur.cols}
          anim={cur.anim}
          move={cur.move}
          color={cur.color}
        />
      )
    }

    if (cur.mode === "replace" && cur.kind) {
      return (
        <Replace
          title={props.title}
          kind={cur.kind}
          cols={cur.cols}
          anim={cur.anim}
          move={cur.move}
          color={cur.color}
        />
      )
    }

    if (cur.mode === "overlay" && cur.kind) {
      return (
        <Overlay
          title={props.title}
          kind={cur.kind}
          cols={cur.cols}
          anim={cur.anim}
          move={cur.move}
          color={cur.color}
        />
      )
    }

    if (cur.mode === "trail" && cur.kind) {
      return <Trail title={props.title} kind={cur.kind} cols={cur.cols} anim={cur.anim} color={cur.color} />
    }

    if (cur.mode === "frame" && cur.kind) {
      return <Frame title={props.title} kind={cur.kind} cols={cur.cols} anim={cur.anim} color={cur.color} />
    }

    return (
      <Square
        title={props.title}
        anim={cur.anim}
        move={cur.move}
        color={cur.color}
        size={cur.size}
        gap={cur.gap}
        low={cur.low}
        high={cur.high}
      />
    )
  })

  return <div class={props.class ?? "min-w-0 grow-1 w-full"}>{body()}</div>
}
