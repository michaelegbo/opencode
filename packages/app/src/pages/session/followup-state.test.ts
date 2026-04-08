import { describe, expect, test } from "bun:test"
import { removeFollowup, type FollowupItem } from "./followup-state"

const item = (id: string): FollowupItem =>
  ({
    id,
    sessionID: "session-1",
    sessionDirectory: "/repo",
    prompt: [{ type: "text", content: id, start: 0, end: id.length }],
    context: [],
    agent: "build",
    model: { providerID: "provider", modelID: "model" },
  }) as FollowupItem

describe("removeFollowup", () => {
  test("removes the matching queued item", () => {
    expect(removeFollowup([item("a"), item("b")], "a").map((entry) => entry.id)).toEqual(["b"])
  })

  test("returns an empty list when items are missing", () => {
    expect(removeFollowup(undefined, "a")).toEqual([])
  })
})
