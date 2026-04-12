import { describe, expect, test } from "bun:test"
import { createMemo, createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import {
  createOpenReviewFile,
  createOpenSessionFileTab,
  createSessionTabs,
  focusTerminalOnKeyDown,
  focusTerminalById,
  getTabReorderIndex,
  shouldFocusTerminalOnKeyDown,
  terminalById,
  waitTerminalFocus,
} from "./helpers"

describe("createOpenReviewFile", () => {
  test("opens and loads selected review file", () => {
    const calls: string[] = []
    const openReviewFile = createOpenReviewFile({
      showAllFiles: () => calls.push("show"),
      tabForPath: (path) => {
        calls.push(`tab:${path}`)
        return `file://${path}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      setActive: (tab) => calls.push(`active:${tab}`),
      loadFile: (path) => calls.push(`load:${path}`),
    })

    openReviewFile("src/a.ts")

    expect(calls).toEqual(["show", "load:src/a.ts", "tab:src/a.ts", "open:file://src/a.ts", "active:file://src/a.ts"])
  })
})

describe("createOpenSessionFileTab", () => {
  test("activates the opened file tab", () => {
    const calls: string[] = []
    const openTab = createOpenSessionFileTab({
      normalizeTab: (value) => {
        calls.push(`normalize:${value}`)
        return `file://${value}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      pathFromTab: (tab) => {
        calls.push(`path:${tab}`)
        return tab.slice("file://".length)
      },
      loadFile: (path) => calls.push(`load:${path}`),
      openReviewPanel: () => calls.push("review"),
      setActive: (tab) => calls.push(`active:${tab}`),
    })

    openTab("src/a.ts")

    expect(calls).toEqual([
      "normalize:src/a.ts",
      "open:file://src/a.ts",
      "path:file://src/a.ts",
      "load:src/a.ts",
      "review",
      "active:file://src/a.ts",
    ])
  })
})

describe("focusTerminalById", () => {
  test("finds the terminal node by id", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-find"><div data-component="terminal" tabindex="0"></div></div>`
    expect(terminalById("find")?.dataset.component).toBe("terminal")
  })

  test("focuses textarea when present", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-one"><div data-component="terminal"><textarea></textarea></div></div>`

    const focused = focusTerminalById("one")

    expect(focused).toBe(true)
    expect(document.activeElement?.tagName).toBe("TEXTAREA")
  })

  test("falls back to terminal element focus", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-two"><div data-component="terminal" tabindex="0"></div></div>`
    const terminal = document.querySelector('[data-component="terminal"]') as HTMLElement
    let pointerDown = false
    terminal.addEventListener("pointerdown", () => {
      pointerDown = true
    })

    const focused = focusTerminalById("two")

    expect(focused).toBe(true)
    expect(document.activeElement).toBe(terminal)
    expect(pointerDown).toBe(true)
  })
})

describe("shouldFocusTerminalOnKeyDown", () => {
  test("skips pure modifier keys", () => {
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Meta", metaKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Alt", altKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }))).toBe(false)
  })

  test("skips shortcut key combos", () => {
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "c", metaKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }))).toBe(false)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true }))).toBe(false)
  })

  test("keeps plain typing focused on terminal", () => {
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "a" }))).toBe(true)
    expect(shouldFocusTerminalOnKeyDown(new KeyboardEvent("keydown", { key: "A", shiftKey: true }))).toBe(true)
  })
})

describe("focusTerminalOnKeyDown", () => {
  test("only swallows typing when terminal focus succeeds", () => {
    const event = new KeyboardEvent("keydown", { key: "a" })
    expect(focusTerminalOnKeyDown(event, { opened: true, id: "one", focus: () => false })).toBe(false)
    expect(focusTerminalOnKeyDown(event, { opened: true, id: "one", focus: () => true })).toBe(true)
  })

  test("ignores typing when terminal is closed or unavailable", () => {
    const event = new KeyboardEvent("keydown", { key: "a" })
    expect(focusTerminalOnKeyDown(event, { opened: false, id: "one", focus: () => true })).toBe(false)
    expect(focusTerminalOnKeyDown(event, { opened: true, id: undefined, focus: () => true })).toBe(false)
  })
})

describe("waitTerminalFocus", () => {
  test("waits for the terminal DOM before focusing", () => {
    const steps: number[] = []
    const timers: Array<() => void> = []
    const calls: string[] = []

    const stop = waitTerminalFocus("later", {
      delays: [10, 20],
      focus: (id) => {
        calls.push(id)
        return true
      },
      frame: (fn) => {
        timers.push(() => fn(0))
        return timers.length
      },
      cancel: () => {},
      timeout: (fn) => {
        timers.push(fn)
        return timers.length
      },
      clear: () => {},
      probe: {
        focus: (count) => steps.push(count),
        step: () => steps.push(-1),
      },
    })

    expect(calls).toEqual([])

    document.body.innerHTML = `<div id="terminal-wrapper-later"><div data-component="terminal" tabindex="0"></div></div>`
    timers[0]?.()

    expect(calls).toEqual(["later"])
    expect(steps[0]).toBe(3)
    expect(steps.includes(-1)).toBe(true)

    stop()
  })

  test("stops when the terminal is no longer active", () => {
    const timers: Array<() => void> = []
    const calls: string[] = []
    let active = "two"

    document.body.innerHTML = `<div id="terminal-wrapper-one"><div data-component="terminal" tabindex="0"></div></div>`

    const stop = waitTerminalFocus("one", {
      active: () => active,
      delays: [10],
      focus: (id) => {
        calls.push(id)
        return true
      },
      frame: (fn) => {
        timers.push(() => fn(0))
        return timers.length
      },
      cancel: () => {},
      timeout: (fn) => {
        timers.push(fn)
        return timers.length
      },
      clear: () => {},
    })

    timers.forEach((run) => run())

    expect(calls).toEqual([])

    active = "one"
    const again = waitTerminalFocus("one", {
      active: () => active,
      focus: (id) => {
        calls.push(id)
        return true
      },
    })

    expect(calls).toEqual(["one"])

    stop()
    again()
  })
})

describe("getTabReorderIndex", () => {
  test("returns target index for valid drag reorder", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "c")).toBe(2)
  })

  test("returns undefined for unknown droppable id", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "missing")).toBeUndefined()
  })
})

describe("createSessionTabs", () => {
  test("normalizes the effective file tab", () => {
    createRoot((dispose) => {
      const [state] = createStore({
        active: undefined as string | undefined,
        all: ["file://src/a.ts", "context"],
      })
      const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
      const result = createSessionTabs({
        tabs,
        pathFromTab: (tab) => (tab.startsWith("file://") ? tab.slice("file://".length) : undefined),
        normalizeTab: (tab) => (tab.startsWith("file://") ? `norm:${tab.slice("file://".length)}` : tab),
      })

      expect(result.activeTab()).toBe("norm:src/a.ts")
      expect(result.activeFileTab()).toBe("norm:src/a.ts")
      expect(result.closableTab()).toBe("norm:src/a.ts")
      dispose()
    })
  })

  test("prefers context and review fallbacks when no file tab is active", () => {
    createRoot((dispose) => {
      const [state] = createStore({
        active: undefined as string | undefined,
        all: ["context"],
      })
      const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
      const result = createSessionTabs({
        tabs,
        pathFromTab: () => undefined,
        normalizeTab: (tab) => tab,
        review: () => true,
        hasReview: () => true,
      })

      expect(result.activeTab()).toBe("context")
      expect(result.closableTab()).toBe("context")
      dispose()
    })

    createRoot((dispose) => {
      const [state] = createStore({
        active: undefined as string | undefined,
        all: [],
      })
      const tabs = createMemo(() => ({ active: () => state.active, all: () => state.all }))
      const result = createSessionTabs({
        tabs,
        pathFromTab: () => undefined,
        normalizeTab: (tab) => tab,
        review: () => true,
        hasReview: () => true,
      })

      expect(result.activeTab()).toBe("review")
      expect(result.activeFileTab()).toBeUndefined()
      expect(result.closableTab()).toBeUndefined()
      dispose()
    })
  })
})
