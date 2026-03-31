import os from "node:os"
import { createHash } from "node:crypto"
import { SessionID } from "@/session/schema"
import { GlobalBus } from "@/bus/global"
import { Log } from "@/util/log"

type Type = "complete" | "permission" | "error"

type Pair = {
  v: 1
  serverID?: string
  relayURL: string
  relaySecret: string
  hosts: string[]
}

type Input = {
  relayURL: string
  relaySecret: string
  hostname: string
  port: number
  advertiseHosts?: string[]
}

type State = {
  relayURL: string
  relaySecret: string
  pair: Pair
  stop: () => void
  seen: Map<string, number>
  gc: number
}

type Event = {
  type: string
  properties: unknown
}

type Notify = {
  type: Type
  sessionID: string
  title?: string
  body?: string
}

const log = Log.create({ service: "push-relay" })

let state: State | undefined

function obj(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null
}

function str(input: unknown) {
  return typeof input === "string" && input.length > 0 ? input : undefined
}

function norm(input: string) {
  return input.replace(/\/+$/, "")
}

function secretHash(input: string) {
  if (!input) return "none"
  return `${createHash("sha256").update(input).digest("hex").slice(0, 12)}...`
}

function serverID(input: { relayURL: string; relaySecret: string }) {
  return createHash("sha256").update(`${input.relayURL}|${input.relaySecret}`).digest("hex").slice(0, 16)
}

/**
 * Classify an IPv4 address into a reachability tier.
 * Lower number = more likely reachable from an external/overlay network device.
 *
 * 0 – public / routable
 * 1 – CGNAT / shared (100.64.0.0/10) – used by Tailscale, Cloudflare WARP, carrier NAT, etc.
 * 2 – private LAN (10.0.0.0/8, 172.16-31.x, 192.168.x)
 * 3 – link-local (169.254.x)
 * 4 – loopback (127.x)
 */
function ipTier(address: string): number {
  const parts = address.split(".")
  if (parts.length !== 4) return 4
  const a = Number(parts[0])
  const b = Number(parts[1])

  // loopback 127.0.0.0/8
  if (a === 127) return 4
  // link-local 169.254.0.0/16
  if (a === 169 && b === 254) return 3
  // private 10.0.0.0/8
  if (a === 10) return 2
  // private 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return 2
  // private 192.168.0.0/16
  if (a === 192 && b === 168) return 2
  // CGNAT / shared address space 100.64.0.0/10 (100.64.x – 100.127.x)
  if (a === 100 && b >= 64 && b <= 127) return 1
  // everything else is routable
  return 0
}

function advertiseURL(input: string, port: number): string | undefined {
  const raw = input.trim()
  if (!raw) return

  try {
    const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`)
    if (!parsed.hostname) return
    if (!parsed.port) {
      parsed.port = String(port)
    }
    return norm(`${parsed.protocol}//${parsed.host}`)
  } catch {
    return
  }
}

function list(hostname: string, port: number, advertised: string[] = []) {
  const seen = new Set<string>()
  const preferred: string[] = []
  const hosts: Array<{ url: string; tier: number }> = []

  const addPreferred = (input: string) => {
    const url = advertiseURL(input, port)
    if (!url) return
    if (seen.has(url)) return
    seen.add(url)
    preferred.push(url)
  }

  const add = (host: string) => {
    if (!host) return
    if (host === "0.0.0.0") return
    if (host === "::") return
    const url = `http://${host}:${port}`
    if (seen.has(url)) return
    seen.add(url)
    hosts.push({ url, tier: ipTier(host) })
  }

  advertised.forEach(addPreferred)

  add(hostname)

  const nets = Object.values(os.networkInterfaces())
    .flatMap((item) => item ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address)

  nets.forEach(add)

  // sort: most externally reachable first, loopback last
  hosts.sort((a, b) => a.tier - b.tier)

  return [...preferred, ...hosts.map((item) => item.url)]
}

function map(event: Event): { type: Type; sessionID: string } | undefined {
  if (!obj(event.properties)) return

  if (event.type === "permission.asked") {
    const sessionID = str(event.properties.sessionID)
    if (!sessionID) return
    return { type: "permission", sessionID }
  }

  if (event.type === "session.error") {
    const sessionID = str(event.properties.sessionID)
    if (!sessionID) return
    return { type: "error", sessionID }
  }

  if (event.type === "session.idle") {
    const sessionID = str(event.properties.sessionID)
    if (!sessionID) return
    return { type: "complete", sessionID }
  }

  if (event.type !== "session.status") return
  const sessionID = str(event.properties.sessionID)
  if (!sessionID) return
  if (!obj(event.properties.status)) return
  if (event.properties.status.type !== "idle") return
  return { type: "complete", sessionID }
}

function text(input: string) {
  return input.replace(/\s+/g, " ").trim()
}

function words(input: string, max = 18, chars = 140) {
  const clean = text(input)
  if (!clean) return ""
  const split = clean.split(" ")
  const cut = split.slice(0, max).join(" ")
  if (cut.length <= chars && split.length <= max) return cut
  const short = cut.slice(0, chars).trim()
  return short.endsWith("…") ? short : `${short}…`
}

function fallback(input: Type) {
  if (input === "complete") return "Session complete."
  if (input === "permission") return "OpenCode needs your permission decision."
  return "OpenCode reported an error for your session."
}

async function notify(input: { type: Type; sessionID: string }): Promise<Notify> {
  const out: Notify = {
    type: input.type,
    sessionID: input.sessionID,
  }

  try {
    const [{ Session }, { MessageV2 }] = await Promise.all([import("@/session"), import("@/session/message-v2")])
    const sessionID = SessionID.make(input.sessionID)
    const session = await Session.get(sessionID)
    out.title = session.title

    let latestUser: string | undefined
    for await (const msg of MessageV2.stream(sessionID)) {
      const body = msg.parts
        .map((part) => {
          if (part.type !== "text") return ""
          if (part.ignored) return ""
          return part.text
        })
        .filter(Boolean)
        .join(" ")
      const next = words(body)
      if (!next) continue

      if (msg.info.role === "assistant") {
        out.body = next
        break
      }

      if (!latestUser && msg.info.role === "user") {
        latestUser = next
      }
    }

    if (!out.body) {
      out.body = latestUser
    }
  } catch (error) {
    log.info("notification metadata unavailable", {
      type: input.type,
      sessionID: input.sessionID,
      error: String(error),
    })
  }

  if (!out.title) out.title = `Session ${input.type}`
  if (!out.body) out.body = fallback(input.type)
  return out
}

function dedupe(input: { type: Type; sessionID: string }) {
  if (input.type !== "complete") return false
  const next = state
  if (!next) return false
  const now = Date.now()

  if (next.seen.size > 2048 || now - next.gc > 60_000) {
    next.gc = now
    for (const [key, time] of next.seen) {
      if (now - time > 60_000) {
        next.seen.delete(key)
      }
    }
    const drop = next.seen.size - 2048
    if (drop > 0) {
      let i = 0
      for (const key of next.seen.keys()) {
        next.seen.delete(key)
        i += 1
        if (i >= drop) break
      }
    }
  }

  const key = `${input.type}:${input.sessionID}`
  const prev = next.seen.get(key)
  next.seen.set(key, now)
  if (!prev) return false
  return now - prev < 5_000
}

async function post(input: { type: Type; sessionID: string }) {
  const next = state
  if (!next) return false
  if (dedupe(input)) return true

  const content = await notify(input)

  log.info("[ APN RELAY ] posting event", {
    serverID: next.pair.serverID,
    relayURL: next.relayURL,
    secretHash: secretHash(next.relaySecret),
    type: input.type,
    sessionID: input.sessionID,
    title: content.title,
  })

  void fetch(`${next.relayURL}/v1/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret: next.relaySecret,
      serverID: next.pair.serverID,
      eventType: input.type,
      sessionID: input.sessionID,
      title: content.title,
      body: content.body,
    }),
  })
    .then(async (res) => {
      if (res.ok) {
        log.info("[ APN RELAY ] relay accepted event", {
          status: res.status,
          serverID: next.pair.serverID,
          secretHash: secretHash(next.relaySecret),
          type: input.type,
          sessionID: input.sessionID,
          title: content.title,
        })
        return
      }
      const error = await res.text().catch(() => "")
      log.warn("relay post failed", {
        status: res.status,
        type: input.type,
        sessionID: input.sessionID,
        title: content.title,
        error,
      })
    })
    .catch((error) => {
      log.warn("relay post failed", {
        type: input.type,
        sessionID: input.sessionID,
        title: content.title,
        error: String(error),
      })
    })

  return true
}

export namespace PushRelay {
  export function start(input: Input) {
    const relayURL = norm(input.relayURL.trim())
    const relaySecret = input.relaySecret.trim()
    if (!relayURL) return
    if (!relaySecret) return

    stop()

    const pair: Pair = {
      v: 1,
      serverID: serverID({ relayURL, relaySecret }),
      relayURL,
      relaySecret,
      hosts: list(input.hostname, input.port, input.advertiseHosts ?? []),
    }

    const callback = (event: { payload: Event }) => {
      const next = map(event.payload)
      if (!next) return
      void post(next)
    }
    GlobalBus.on("event", callback)
    const unsub = () => {
      GlobalBus.off("event", callback)
    }

    state = {
      relayURL,
      relaySecret,
      pair,
      stop: unsub,
      seen: new Map(),
      gc: 0,
    }

    log.info("enabled", {
      relayURL,
      hosts: pair.hosts,
    })

    return pair
  }

  export function stop() {
    const next = state
    if (!next) return
    state = undefined
    next.stop()
  }

  export function status() {
    const next = state
    if (!next) {
      return {
        enabled: false,
        relaySecretSet: false,
      } as const
    }
    return {
      enabled: true,
      relaySecretSet: next.relaySecret.length > 0,
    } as const
  }

  export function pair() {
    return state?.pair
  }

  export function test(input: { type: Type; sessionID: string }) {
    void post(input)
    return true
  }

  export function auth(input: string) {
    const next = state
    if (!next) return false
    return next.relaySecret === input
  }
}
