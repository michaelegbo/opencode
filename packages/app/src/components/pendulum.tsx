import type { ComponentProps } from "solid-js"
import { createEffect, createSignal, onCleanup } from "solid-js"

type Kind = "pendulum" | "compress" | "sort"

export type BrailleKind = Kind

const bits = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
]

const seeded = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const pendulum = (cols: number, max = 1) => {
  const total = 120
  const span = cols * 2
  const frames = [] as string[]

  for (let t = 0; t < total; t++) {
    const codes = Array.from({ length: cols }, () => 0x2800)
    const p = t / total
    const spread = Math.sin(Math.PI * p) * max
    const phase = p * Math.PI * 8

    for (let pc = 0; pc < span; pc++) {
      const swing = Math.sin(phase + pc * spread)
      const center = (1 - swing) * 1.5

      for (let row = 0; row < 4; row++) {
        if (Math.abs(row - center) >= 0.7) continue
        codes[Math.floor(pc / 2)] |= bits[row][pc % 2]
      }
    }

    frames.push(codes.map((code) => String.fromCharCode(code)).join(""))
  }

  return frames
}

const compress = (cols: number) => {
  const total = 100
  const span = cols * 2
  const dots = span * 4
  const frames = [] as string[]
  const rand = seeded(42)
  const weight = Array.from({ length: dots }, () => rand())

  for (let t = 0; t < total; t++) {
    const codes = Array.from({ length: cols }, () => 0x2800)
    const p = t / total
    const sieve = Math.max(0.1, 1 - p * 1.2)
    const squeeze = Math.min(1, p / 0.85)
    const active = Math.max(1, span * (1 - squeeze * 0.95))

    for (let pc = 0; pc < span; pc++) {
      const map = (pc / span) * active
      if (map >= active) continue

      const next = Math.round(map)
      if (next >= span) continue

      const char = Math.floor(next / 2)
      const dot = next % 2

      for (let row = 0; row < 4; row++) {
        if (weight[pc * 4 + row] >= sieve) continue
        codes[char] |= bits[row][dot]
      }
    }

    frames.push(codes.map((code) => String.fromCharCode(code)).join(""))
  }

  return frames
}

const sort = (cols: number) => {
  const span = cols * 2
  const total = 100
  const frames = [] as string[]
  const rand = seeded(19)
  const start = Array.from({ length: span }, () => rand() * 3)
  const end = Array.from({ length: span }, (_, i) => (i / Math.max(1, span - 1)) * 3)

  for (let t = 0; t < total; t++) {
    const codes = Array.from({ length: cols }, () => 0x2800)
    const p = t / total
    const cursor = p * span * 1.2

    for (let pc = 0; pc < span; pc++) {
      const char = Math.floor(pc / 2)
      const dot = pc % 2
      const delta = pc - cursor
      let center

      if (delta < -3) {
        center = end[pc]
      } else if (delta < 2) {
        const blend = 1 - (delta + 3) / 5
        const ease = blend * blend * (3 - 2 * blend)
        center = start[pc] + (end[pc] - start[pc]) * ease
        if (Math.abs(delta) < 0.8) {
          for (let row = 0; row < 4; row++) codes[char] |= bits[row][dot]
          continue
        }
      } else {
        center = start[pc] + Math.sin(p * Math.PI * 16 + pc * 2.7) * 0.6 + Math.sin(p * Math.PI * 9 + pc * 1.3) * 0.4
      }

      center = Math.max(0, Math.min(3, center))
      for (let row = 0; row < 4; row++) {
        if (Math.abs(row - center) >= 0.7) continue
        codes[char] |= bits[row][dot]
      }
    }

    frames.push(codes.map((code) => String.fromCharCode(code)).join(""))
  }

  return frames
}

const build = (kind: Kind, cols: number) => {
  if (kind === "compress") return compress(cols)
  if (kind === "sort") return sort(cols)
  return pendulum(cols)
}

const pace = (kind: Kind) => {
  if (kind === "pendulum") return 16
  return 40
}

const cache = new Map<string, string[]>()

const get = (kind: Kind, cols: number) => {
  const key = `${kind}:${cols}`
  const saved = cache.get(key)
  if (saved) return saved
  const made = build(kind, cols)
  cache.set(key, made)
  return made
}

export const getBrailleFrames = (kind: Kind, cols: number) => get(kind, cols)

export function Braille(props: {
  kind?: Kind
  cols?: number
  rate?: number
  class?: string
  classList?: ComponentProps<"span">["classList"]
  style?: ComponentProps<"span">["style"]
  label?: string
}) {
  const kind = () => props.kind ?? "pendulum"
  const cols = () => props.cols ?? 2
  const rate = () => props.rate ?? 1
  const [idx, setIdx] = createSignal(0)

  createEffect(() => {
    if (typeof window === "undefined") return
    const frames = get(kind(), cols())
    setIdx(0)
    const id = window.setInterval(
      () => {
        setIdx((idx) => (idx + 1) % frames.length)
      },
      Math.max(10, Math.round(pace(kind()) / rate())),
    )
    onCleanup(() => window.clearInterval(id))
  })

  return (
    <span
      role="status"
      aria-label={props.label ?? "Loading"}
      class={props.class}
      classList={props.classList}
      style={props.style}
    >
      <span aria-hidden="true">{get(kind(), cols())[idx()]}</span>
    </span>
  )
}

export function Pendulum(props: Omit<Parameters<typeof Braille>[0], "kind">) {
  return <Braille {...props} kind="pendulum" />
}
