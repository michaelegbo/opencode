import { describe, expect, test } from "bun:test"
import { SessionPrompt } from "../../src/session/prompt"
import { PartID, SessionID } from "../../src/session/schema"
import type { MessageV2 } from "../../src/session/message-v2"

const base = {
  sessionID: SessionID.make("ses_test"),
  messageID: "msg_test",
}

const text = (value: string, start?: number) =>
  ({
    ...base,
    id: PartID.ascending(),
    type: "text",
    text: value,
    ...(start === undefined ? {} : { time: { start } }),
  }) as MessageV2.Part

const tool = (end = 2) =>
  ({
    ...base,
    id: PartID.ascending(),
    type: "tool",
    callID: "call_test",
    tool: "read",
    state: {
      status: "completed",
      input: {},
      output: "",
      title: "",
      metadata: {},
      time: { start: 1, end },
    },
  }) as MessageV2.Part

describe("SessionPrompt.needsToolFollowup", () => {
  test("continues when a stopped assistant has no text after the last tool", () => {
    expect(SessionPrompt.needsToolFollowup([tool()])).toBe(true)
    expect(SessionPrompt.needsToolFollowup([text("before"), tool()])).toBe(true)
  })

  test("stops when final text follows tool parts", () => {
    expect(SessionPrompt.needsToolFollowup([tool(), text("done", 3)])).toBe(false)
    expect(SessionPrompt.needsToolFollowup([tool(), text("done")])).toBe(false)
  })

  test("continues when text after a tool part started before the tool result", () => {
    expect(SessionPrompt.needsToolFollowup([tool(5), text("before result", 3)])).toBe(true)
  })

  test("does not require tool follow-up without tool parts", () => {
    expect(SessionPrompt.needsToolFollowup([text("done")])).toBe(false)
    expect(SessionPrompt.needsToolFollowup(undefined)).toBe(false)
  })
})
