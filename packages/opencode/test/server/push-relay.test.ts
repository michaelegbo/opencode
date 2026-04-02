import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalBus } from "../../src/bus/global"
import { PushRelay } from "../../src/server/push-relay"

let originalFetch: typeof fetch
let fetchMock: ReturnType<typeof mock>

function emit(type: string, properties: unknown) {
  GlobalBus.emit("event", {
    payload: {
      type,
      properties,
    },
  })
}

async function waitForCalls(count: number) {
  for (let i = 0; i < 50; i++) {
    if (fetchMock.mock.calls.length >= count) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  expect(fetchMock.mock.calls.length).toBe(count)
}

function callBody(index = 0) {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined
  if (!init?.body) return
  return JSON.parse(String(init.body)) as {
    eventType: "complete" | "permission" | "error"
    sessionID: string
  }
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  fetchMock = mock(() => Promise.resolve(new Response("ok", { status: 200 })))
  globalThis.fetch = fetchMock as unknown as typeof fetch

  PushRelay.start({
    relayURL: "https://relay.example.com",
    relaySecret: "test-secret",
    hostname: "127.0.0.1",
    port: 4096,
  })
})

afterEach(() => {
  PushRelay.stop()
  globalThis.fetch = originalFetch
})

describe("push relay event mapping", () => {
  test("relays completion from session.status idle", async () => {
    emit("session.status", {
      sessionID: "ses_status_idle",
      status: { type: "idle" },
    })

    await waitForCalls(1)
    expect(callBody()?.eventType).toBe("complete")
  })

  test("ignores deprecated session.idle events", async () => {
    emit("session.idle", {
      sessionID: "ses_deprecated_idle",
    })

    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(fetchMock.mock.calls.length).toBe(0)
  })

  test("ignores non-actionable session errors", async () => {
    emit("session.error", {
      sessionID: "ses_aborted",
      error: { name: "MessageAbortedError", data: { message: "Aborted" } },
    })
    emit("session.error", {
      sessionID: "ses_overflow",
      error: { name: "ContextOverflowError", data: { message: "Too long" } },
    })

    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(fetchMock.mock.calls.length).toBe(0)
  })

  test("relays actionable session errors", async () => {
    emit("session.error", {
      sessionID: "ses_unknown_error",
      error: { name: "UnknownError", data: { message: "boom" } },
    })

    await waitForCalls(1)
    expect(callBody()?.eventType).toBe("error")
  })

  test("relays permission prompts", async () => {
    emit("permission.asked", {
      sessionID: "ses_permission",
    })

    await waitForCalls(1)
    expect(callBody()?.eventType).toBe("permission")
  })
})
