import { describe, expect, test } from "bun:test"
import type { AssistantMessage, Message as MessageType, UserMessage } from "@opencode-ai/sdk/v2"
import { pending, working } from "./activity"

const user = (id: string) =>
  ({
    id,
    sessionID: "ses_1",
    role: "user",
    time: { created: 1 },
  }) as UserMessage

const assistant = (id: string, parentID: string, completed?: number) =>
  ({
    id,
    sessionID: "ses_1",
    parentID,
    role: "assistant",
    time: completed === undefined ? { created: 2 } : { created: 2, completed },
  }) as AssistantMessage

describe("session activity", () => {
  test("treats only non-idle status as running", () => {
    expect(working(undefined)).toBe(false)
    expect(working({ type: "idle" })).toBe(false)
    expect(working({ type: "busy" })).toBe(true)
    expect(working({ type: "retry", attempt: 1, message: "retry", next: 1 })).toBe(true)
  })

  test("returns the trailing incomplete assistant", () => {
    const messages: MessageType[] = [user("msg_1"), assistant("msg_2", "msg_1")]

    expect(pending(messages)?.id).toBe("msg_2")
  })

  test("ignores older incomplete assistants once a later assistant completed", () => {
    const messages: MessageType[] = [
      user("msg_1"),
      assistant("msg_2", "msg_1"),
      user("msg_3"),
      assistant("msg_4", "msg_3", 4),
    ]

    expect(pending(messages)).toBeUndefined()
  })
})
