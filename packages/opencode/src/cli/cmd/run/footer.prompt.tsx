// Prompt textarea component and its state machine for direct interactive mode.
//
// createPromptState() wires keybinds, history navigation, leader-key sequences
// for variant cycling, and the submit/interrupt/exit flow. It produces a
// PromptState that RunPromptBody renders as an OpenTUI textarea.
//
// The leader-key pattern: press the leader key (default ctrl+x), then press
// "t" within 2 seconds to cycle the model variant. This mirrors vim-style
// two-key sequences. The timer auto-clears if the second key doesn't arrive.
//
// History uses arrow keys at cursor boundaries: up at offset 0 scrolls back,
// down at end-of-text scrolls forward, restoring the draft when you return
// past the end of history.
/** @jsxImportSource @opentui/solid */
import { StyledText, bg, fg, type KeyBinding } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createEffect, createMemo, createSignal, onCleanup, onMount, type Accessor } from "solid-js"
import {
  createPromptHistory,
  isExitCommand,
  movePromptHistory,
  promptCycle,
  promptHit,
  promptInfo,
  promptKeys,
  pushPromptHistory,
} from "./prompt.shared"
import type { FooterKeybinds, FooterState } from "./types"
import type { RunFooterTheme } from "./theme"

const LEADER_TIMEOUT_MS = 2000

export const TEXTAREA_MIN_ROWS = 1
export const TEXTAREA_MAX_ROWS = 6

export const HINT_BREAKPOINTS = {
  send: 50,
  newline: 66,
  history: 80,
  variant: 95,
}

type Area = {
  isDestroyed: boolean
  virtualLineCount: number
  visualCursor: {
    visualRow: number
  }
  plainText: string
  cursorOffset: number
  height?: number
  setText(text: string): void
  focus(): void
  on(event: string, fn: () => void): void
  off(event: string, fn: () => void): void
}

type Key = {
  name: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  super?: boolean
  hyper?: boolean
  preventDefault(): void
}

type PromptInput = {
  keybinds: FooterKeybinds
  state: Accessor<FooterState>
  view: Accessor<string>
  prompt: Accessor<boolean>
  width: Accessor<number>
  theme: Accessor<RunFooterTheme>
  history?: string[]
  onSubmit: (text: string) => boolean
  onCycle: () => void
  onInterrupt: () => boolean
  onExitRequest?: () => boolean
  onExit: () => void
  onRows: (rows: number) => void
  onStatus: (text: string) => void
}

export type PromptState = {
  placeholder: Accessor<StyledText | string>
  bindings: Accessor<KeyBinding[]>
  onSubmit: () => void
  onKeyDown: (event: Key) => void
  onContentChange: () => void
  bind: (area?: Area) => void
}

function clamp(rows: number): number {
  return Math.max(TEXTAREA_MIN_ROWS, Math.min(TEXTAREA_MAX_ROWS, rows))
}

export function hintFlags(width: number) {
  return {
    send: width >= HINT_BREAKPOINTS.send,
    newline: width >= HINT_BREAKPOINTS.newline,
    history: width >= HINT_BREAKPOINTS.history,
    variant: width >= HINT_BREAKPOINTS.variant,
  }
}

export function RunPromptBody(props: {
  theme: () => RunFooterTheme
  placeholder: () => StyledText | string
  bindings: () => KeyBinding[]
  onSubmit: () => void
  onKeyDown: (event: Key) => void
  onContentChange: () => void
  bind: (area?: Area) => void
}) {
  let item: Area | undefined

  onMount(() => {
    props.bind(item)
  })

  onCleanup(() => {
    props.bind(undefined)
  })

  return (
    <box id="run-direct-footer-prompt"
      paddingTop={1}
      paddingLeft={2}
      paddingRight={2}
    >
      <textarea
        id="run-direct-footer-composer"
        width="100%"
        minHeight={TEXTAREA_MIN_ROWS}
        maxHeight={TEXTAREA_MAX_ROWS}
        wrapMode="word"
        placeholder={props.placeholder()}
        placeholderColor={props.theme().muted}
        textColor={props.theme().text}
        focusedTextColor={props.theme().text}

        backgroundColor={props.theme().surface}
        focusedBackgroundColor={props.theme().surface}
        cursorColor={props.theme().text}
        keyBindings={props.bindings()}
        onSubmit={props.onSubmit}
        onKeyDown={props.onKeyDown}
        onContentChange={props.onContentChange}
        ref={(next) => {
          item = next as Area
        }}
      />
    </box>
  )
}

export function createPromptState(input: PromptInput): PromptState {
  const keys = createMemo(() => promptKeys(input.keybinds))
  const bindings = createMemo(() => keys().bindings)
  const [draft, setDraft] = createSignal("")
  const placeholder = createMemo(() => {
    if (!input.state().first) {
      return ""
    }

    return new StyledText([
      bg(input.theme().surface)(fg(input.theme().muted)('Ask anything... "Fix a TODO in the codebase"')),
    ])
  })

  let history = createPromptHistory(input.history)

  let area: Area | undefined
  let leader = false
  let timeout: NodeJS.Timeout | undefined
  let tick = false
  let prev = input.view()

  const clear = () => {
    leader = false
    if (!timeout) {
      return
    }

    clearTimeout(timeout)
    timeout = undefined
  }

  const arm = () => {
    clear()
    leader = true
    timeout = setTimeout(() => {
      clear()
    }, LEADER_TIMEOUT_MS)
  }

  const syncRows = () => {
    if (!area || area.isDestroyed) {
      return
    }

    input.onRows(clamp(area.virtualLineCount || 1))
  }

  const scheduleRows = () => {
    if (tick) {
      return
    }

    tick = true
    queueMicrotask(() => {
      tick = false
      syncRows()
    })
  }

  const bind = (next?: Area) => {
    if (area === next) {
      return
    }

    if (area && !area.isDestroyed) {
      area.off("line-info-change", scheduleRows)
    }

    area = next
    if (!area || area.isDestroyed) {
      return
    }

    area.on("line-info-change", scheduleRows)
    queueMicrotask(() => {
      if (!area || area.isDestroyed || !input.prompt()) {
        return
      }

      if (area.plainText !== draft()) {
        area.setText(draft())
      }

      area.cursorOffset = area.plainText.length
      scheduleRows()
      area.focus()
    })
  }

  const syncDraft = () => {
    if (!area || area.isDestroyed) {
      return
    }

    setDraft(area.plainText)
  }

  const push = (text: string) => {
    history = pushPromptHistory(history, text)
  }

  const move = (dir: -1 | 1, event: Key) => {
    if (!area || area.isDestroyed) {
      return
    }

    const next = movePromptHistory(history, dir, area.plainText, area.cursorOffset)
    if (!next.apply || next.text === undefined || next.cursor === undefined) {
      return
    }

    history = next.state
    area.setText(next.text)
    area.cursorOffset = next.cursor
    event.preventDefault()
    syncRows()
  }

  const cycle = (event: Key): boolean => {
    const next = promptCycle(leader, promptInfo(event), keys().leaders, keys().cycles)
    if (!next.consume) {
      return false
    }

    if (next.clear) {
      clear()
    }

    if (next.arm) {
      arm()
    }

    if (next.cycle) {
      input.onCycle()
    }

    event.preventDefault()
    return true
  }

  const onKeyDown = (event: Key) => {
    if (event.ctrl && event.name === "c") {
      const handled = input.onExitRequest ? input.onExitRequest() : (input.onExit(), true)
      if (handled) {
        event.preventDefault()
      }
      return
    }

    const key = promptInfo(event)
    if (promptHit(keys().interrupts, key)) {
      if (input.onInterrupt()) {
        event.preventDefault()
        return
      }
    }

    if (cycle(event)) {
      return
    }

    const up = promptHit(keys().previous, key)
    const down = promptHit(keys().next, key)
    if (!up && !down) {
      return
    }

    if (!area || area.isDestroyed) {
      return
    }

    const dir = up ? -1 : 1
    if ((dir === -1 && area.cursorOffset === 0) || (dir === 1 && area.cursorOffset === area.plainText.length)) {
      move(dir, event)
      return
    }

    if (dir === -1 && area.visualCursor.visualRow === 0) {
      area.cursorOffset = 0
    }

    const end =
      typeof area.height === "number" && Number.isFinite(area.height) && area.height > 0
        ? area.height - 1
        : Math.max(0, area.virtualLineCount - 1)
    if (dir === 1 && area.visualCursor.visualRow === end) {
      area.cursorOffset = area.plainText.length
    }
  }

  useKeyboard((event) => {
    if (input.prompt()) {
      return
    }

    if (event.ctrl && event.name === "c") {
      const handled = input.onExitRequest ? input.onExitRequest() : (input.onExit(), true)
      if (handled) {
        event.preventDefault()
      }
    }
  })

  const onSubmit = () => {
    if (!area || area.isDestroyed) {
      return
    }

    const text = area.plainText.trim()
    if (!text) {
      input.onStatus(input.state().phase === "running" ? "waiting for current response" : "empty prompt ignored")
      return
    }

    if (isExitCommand(text)) {
      input.onExit()
      return
    }

    area.setText("")
    setDraft("")
    scheduleRows()
    area.focus()
    queueMicrotask(() => {
      if (input.onSubmit(text)) {
        push(text)
        return
      }

      if (!area || area.isDestroyed) {
        return
      }

      area.setText(text)
      setDraft(text)
      area.cursorOffset = area.plainText.length
      syncRows()
      area.focus()
    })
  }

  onCleanup(() => {
    clear()
    if (area && !area.isDestroyed) {
      area.off("line-info-change", scheduleRows)
    }
  })

  createEffect(() => {
    input.width()
    if (input.prompt()) {
      scheduleRows()
    }
  })

  createEffect(() => {
    input.state().phase
    if (!input.prompt() || !area || area.isDestroyed || input.state().phase !== "idle") {
      return
    }

    queueMicrotask(() => {
      if (!area || area.isDestroyed) {
        return
      }

      area.focus()
    })
  })

  createEffect(() => {
    const type = input.view()
    if (type === prev) {
      return
    }

    if (prev === "prompt") {
      syncDraft()
    }

    clear()
    prev = type
    if (type !== "prompt") {
      return
    }

    queueMicrotask(() => {
      if (!area || area.isDestroyed) {
        return
      }

      if (area.plainText !== draft()) {
        area.setText(draft())
      }

      area.cursorOffset = area.plainText.length
      scheduleRows()
      area.focus()
    })
  })

  return {
    placeholder,
    bindings,
    onSubmit,
    onKeyDown,
    onContentChange: () => {
      syncDraft()
      scheduleRows()
    },
    bind,
  }
}
