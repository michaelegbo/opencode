import type { KeybindKey } from "@/cli/cmd/tui/context/keybind"

type Mode = "normal" | "shell"

type Key = {
  readonly name?: string
  readonly shift?: boolean
}

export function shellPassthrough<E extends Key>(
  keybind: { readonly match: (key: KeybindKey, evt: E) => boolean | undefined },
  evt: E,
  mode: Mode,
) {
  return mode === "shell" && (keybind.match("agent_cycle", evt) || keybind.match("agent_cycle_reverse", evt))
}
