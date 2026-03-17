import { describe, expect, test } from "bun:test"
import { shellPassthrough } from "../../../src/cli/cmd/tui/component/prompt/key"

const key = (name: string, extra: { readonly shift?: boolean } = {}) => ({
  name,
  shift: false,
  ...extra,
})

describe("shellPassthrough", () => {
  test("allows tab agent-cycle bindings to pass through in shell mode", () => {
    const match = (target: string, evt: { readonly name?: string }) => target === "agent_cycle" && evt.name === "tab"
    expect(shellPassthrough({ match }, key("tab"), "shell")).toBe(true)
  })

  test("allows reverse agent-cycle bindings to pass through in shell mode", () => {
    const match = (target: string, evt: { readonly name?: string; readonly shift?: boolean }) =>
      target === "agent_cycle_reverse" && evt.name === "tab" && evt.shift
    expect(shellPassthrough({ match }, key("tab", { shift: true }), "shell")).toBe(true)
  })

  test("does not bypass agent-cycle outside shell mode", () => {
    const match = (target: string, evt: { readonly name?: string }) => target === "agent_cycle" && evt.name === "tab"
    expect(shellPassthrough({ match }, key("tab"), "normal")).toBe(false)
  })
})
