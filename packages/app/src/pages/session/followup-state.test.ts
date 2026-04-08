import { describe, expect, test } from "bun:test"
import { moveFollowup, removeFollowup, type FollowupItem } from "./followup-state"

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

describe("moveFollowup", () => {
  test("moves a queued item before another item", () => {
    expect(moveFollowup([item("a"), item("b"), item("c")], "c", "a").map((entry) => entry.id)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  test("returns the same order when either item is missing", () => {
    expect(moveFollowup([item("a"), item("b")], "c", "a").map((entry) => entry.id)).toEqual(["a", "b"])
  })
})
