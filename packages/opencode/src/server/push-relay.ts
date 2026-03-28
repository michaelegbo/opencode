import os from "node:os"
import { Bus } from "@/bus"
import { Log } from "@/util/log"

type Type = "complete" | "permission" | "error"

type Pair = {
  v: 1
  relayURL: string
  relaySecret: string
  hosts: string[]
}

type Input = {
  relayURL: string
  relaySecret: string
  hostname: string
  port: number
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

function list(hostname: string, port: number) {
  const urls = new Set<string>()
  const add = (host: string) => {
    if (!host) return
    if (host === "0.0.0.0") return
    if (host === "::") return
    urls.add(`http://${host}:${port}`)
  }

  add(hostname)
  add("127.0.0.1")

  const nets = Object.values(os.networkInterfaces())
    .flatMap((item) => item ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address)

  nets.forEach(add)

  return [...urls]
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

function post(input: { type: Type; sessionID: string }) {
  const next = state
  if (!next) return false
  if (dedupe(input)) return true

  void fetch(`${next.relayURL}/v1/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret: next.relaySecret,
      eventType: input.type,
      sessionID: input.sessionID,
    }),
  })
    .then(async (res) => {
      if (res.ok) return
      const error = await res.text().catch(() => "")
      log.warn("relay post failed", {
        status: res.status,
        type: input.type,
        sessionID: input.sessionID,
        error,
      })
    })
    .catch((error) => {
      log.warn("relay post failed", {
        type: input.type,
        sessionID: input.sessionID,
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
      relayURL,
      relaySecret,
      hosts: list(input.hostname, input.port),
    }

    let unsub: (() => void) | undefined
    try {
      unsub = Bus.subscribeAll((event) => {
        const next = map(event)
        if (!next) return
        post(next)
      })
    } catch (error) {
      log.warn("failed to subscribe", {
        error: String(error),
      })
      return
    }
    if (!unsub) return

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
    return post(input)
  }

  export function auth(input: string) {
    const next = state
    if (!next) return false
    return next.relaySecret === input
  }
}
