/**
 * Shared core for mock runners: HTTP, SSE, script generation, message handling.
 */

import path from "path"

// ── Types ───────────────────────────────────────────────────────────────

export type Tool = {
  id: string
  description: string
  parameters: {
    type: string
    properties?: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

export type Action =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "thinking"; content: string }
  | { type: "list_tools" }
  | { type: "error"; message: string }

export type Script = { steps: Action[][] }
export type Event = { type: string; properties: Record<string, any> }
export type Message = { info: Record<string, any>; parts: Record<string, any>[] }
type Listener = (event: Event) => void

export type Instance = {
  name: string
  base: string
  sse: AbortController
}

// ── HTTP ────────────────────────────────────────────────────────────────

export async function api<T = unknown>(base: string, method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${base}${path}`, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as T
}

// ── SSE ─────────────────────────────────────────────────────────────────

const listeners = new Map<AbortController, Listener>()

function subscribe(base: string, cb: Listener): AbortController {
  const abort = new AbortController()
  ;(async () => {
    const res = await fetch(`${base}/event`, {
      headers: { Accept: "text/event-stream" },
      signal: abort.signal,
    })
    if (!res.ok || !res.body) {
      log("SSE connect failed", base, res.status)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop()!
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          cb(JSON.parse(line.slice(6)))
        } catch {}
      }
    }
  })().catch(() => {})
  return abort
}

export function startSSE(base: string): AbortController {
  const ctrl = subscribe(base, (evt) => {
    const fn = listeners.get(ctrl)
    fn?.(evt)
  })
  listeners.set(ctrl, () => {})
  return ctrl
}

export function idle(sid: string, sse: AbortController, timeout = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`session ${sid} did not become idle within ${timeout}ms`))
    }, timeout)

    const orig = listeners.get(sse)
    const handler = (evt: Event) => {
      orig?.(evt)
      if (evt.type !== "session.status") return
      if (evt.properties.sessionID !== sid) return
      if (evt.properties.status?.type === "idle") {
        cleanup()
        resolve()
      }
    }
    listeners.set(sse, handler)

    function cleanup() {
      clearTimeout(timer)
      if (orig) listeners.set(sse, orig)
    }
  })
}

// ── Tool discovery ──────────────────────────────────────────────────────

let cachedTools: Tool[] | undefined

export async function tools(base: string): Promise<Tool[]> {
  if (cachedTools) return cachedTools
  cachedTools = await api<Tool[]>(base, "GET", "/experimental/tool?provider=mock&model=mock-model")
  return cachedTools
}

// ── Random generators ───────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const WORDS = [
  "foo",
  "bar",
  "baz",
  "qux",
  "hello",
  "world",
  "test",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "src",
  "lib",
  "tmp",
]
const EXTS = [".ts", ".js", ".json", ".txt", ".md"]

function word() {
  return pick(WORDS)
}

function sentence() {
  const n = rand(3, 12)
  return Array.from({ length: n }, () => word()).join(" ")
}

function filepath() {
  const depth = rand(1, 3)
  const parts = Array.from({ length: depth }, () => word())
  return parts.join("/") + pick(EXTS)
}

function fakeInput(tool: Tool): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const props = tool.parameters.properties ?? {}
  for (const [key, schema] of Object.entries(props)) {
    switch (schema.type) {
      case "string":
        if (key.toLowerCase().includes("path") || key.toLowerCase().includes("file")) {
          result[key] = filepath()
        } else if (key.toLowerCase().includes("pattern") || key.toLowerCase().includes("regex")) {
          result[key] = word()
        } else if (key.toLowerCase().includes("command") || key.toLowerCase().includes("cmd")) {
          result[key] = `echo ${word()}`
        } else {
          result[key] = sentence()
        }
        break
      case "number":
      case "integer":
        result[key] = rand(1, 100)
        break
      case "boolean":
        result[key] = Math.random() > 0.5
        break
      case "object":
        result[key] = {}
        break
      case "array":
        result[key] = []
        break
      default:
        result[key] = sentence()
    }
  }
  return result
}

// ── Action generators ───────────────────────────────────────────────────

const SAFE_TOOLS = new Set(["read", "glob", "grep", "todowrite", "webfetch", "websearch", "codesearch"])
const WRITE_TOOLS = new Set(["write", "edit", "bash"])

function textAction(): Action {
  return { type: "text", content: sentence() }
}

function thinkingAction(): Action {
  return { type: "thinking", content: sentence() }
}

function errorAction(): Action {
  return { type: "error", message: `mock error: ${word()}` }
}

function listToolsAction(): Action {
  return { type: "list_tools" }
}

async function toolAction(base: string): Promise<Action> {
  const all = await tools(base)
  const safe = all.filter((t) => SAFE_TOOLS.has(t.id) || WRITE_TOOLS.has(t.id))
  if (!safe.length) return textAction()
  const tool = pick(safe)
  return { type: "tool_call", name: tool.id, input: fakeInput(tool) }
}

// ── Script generation ───────────────────────────────────────────────────

export async function script(base: string): Promise<Script> {
  const r = Math.random()

  if (r < 0.4) {
    const call = await toolAction(base)
    return { steps: [[call], [textAction()]] }
  }
  if (r < 0.6) {
    return { steps: [[thinkingAction(), textAction()]] }
  }
  if (r < 0.75) {
    const n = rand(2, 4)
    const calls: Action[] = []
    for (let i = 0; i < n; i++) calls.push(await toolAction(base))
    return { steps: [calls, [textAction()]] }
  }
  if (r < 0.85) {
    return { steps: [[textAction()]] }
  }
  if (r < 0.9) {
    return { steps: [[listToolsAction()]] }
  }
  if (r < 0.95) {
    const call = await toolAction(base)
    return { steps: [[thinkingAction(), call], [textAction()]] }
  }
  return { steps: [[errorAction()]] }
}

// ── Pre-generate all scripts for a session ──────────────────────────────

export async function generate(base: string, count: number): Promise<Script[]> {
  const scripts: Script[] = []
  for (let i = 0; i < count; i++) scripts.push(await script(base))
  return scripts
}

// ── Messages ────────────────────────────────────────────────────────────

export async function messages(base: string, sid: string): Promise<Message[]> {
  return api<Message[]>(base, "GET", `/session/${sid}/message`)
}

// ── Run a full session: send all scripts, return all messages ───────────

export async function run(inst: Instance, scripts: Script[]): Promise<Message[]> {
  const info = await api<{ id: string }>(inst.base, "POST", "/session", {})
  const sid = info.id

  for (const s of scripts) {
    const payload = JSON.stringify(s)
    await api(inst.base, "POST", `/session/${sid}/prompt_async`, {
      parts: [{ type: "text", text: payload }],
      model: { providerID: "mock", modelID: "mock-model" },
    })
    await idle(sid, inst.sse)
  }

  return messages(inst.base, sid)
}

// ── Connect to an instance ──────────────────────────────────────────────

export async function connect(name: string, port: string): Promise<Instance> {
  const base = `http://localhost:${port}`
  const health = await api<{ healthy: boolean; version: string }>(base, "GET", "/global/health")
  if (!health.healthy) throw new Error(`${name} not healthy`)
  log(`${name}: version ${health.version} at ${base}`)
  const sse = startSSE(base)
  return { name, base, sse }
}

// ── Logging ─────────────────────────────────────────────────────────────

export function log(...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23)
  console.log(`[${ts}]`, ...args)
}

export function summary(s: Script): string {
  const actions = s.steps.flat()
  const types = actions.map((a) => {
    if (a.type === "tool_call") return `tool:${a.name}`
    return a.type
  })
  return `${s.steps.length} step(s): ${types.join(", ")}`
}

export function logMessages(msgs: Message[]) {
  for (const msg of msgs) {
    const role = msg.info.role
    const parts = msg.parts.map((p: any) => {
      if (p.type === "text") return `text: ${p.text?.slice(0, 80)}${p.text?.length > 80 ? "..." : ""}`
      if (p.type === "tool") return `tool:${p.tool}(${p.state?.status})`
      if (p.type === "reasoning") return `reasoning: ${p.text?.slice(0, 60)}${(p.text?.length ?? 0) > 60 ? "..." : ""}`
      if (p.type === "step-start") return "step-start"
      if (p.type === "step-finish") return `step-finish(${p.reason})`
      return p.type
    })
    log(`    ${role} [${msg.info.id?.slice(0, 8)}] ${parts.join(" | ")}`)
  }
}
