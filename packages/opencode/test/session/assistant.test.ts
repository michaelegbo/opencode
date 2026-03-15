import { describe, expect, test } from "bun:test"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { done } from "../../src/session/assistant"
import type { MessageV2 } from "../../src/session/message-v2"
import { SessionID } from "../../src/session/schema"

const sessionID = SessionID.make("session")
const providerID = ProviderID.make("test")
const modelID = ModelID.make("model")

const assistant = (completed?: number) =>
  ({
    id: "msg_1",
    sessionID,
    parentID: "msg_0",
    role: "assistant",
    time: completed === undefined ? { created: 1 } : { created: 1, completed },
    mode: "build",
    agent: "build",
    path: { cwd: "/", root: "/" },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    modelID,
    providerID,
  }) as MessageV2.Assistant

describe("session assistant", () => {
  test("marks incomplete assistants as done", () => {
    const msg = assistant()

    expect(done(msg, 10).time.completed).toBe(10)
  })

  test("preserves existing completion time", () => {
    const msg = assistant(5)

    expect(done(msg, 10).time.completed).toBe(5)
  })
})
