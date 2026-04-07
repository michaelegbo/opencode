import { type ComponentProps, Show, splitProps } from "solid-js"
import { Button, type ButtonProps } from "./button"
import { Keybind } from "./keybind"

export interface ButtonShortcutProps extends ButtonProps {
  shortcut?: string
  shortcutAria?: string
  shortcutClass?: string
  shortcutClassList?: ComponentProps<"span">["classList"]
}

export function ButtonShortcut(props: ButtonShortcutProps) {
  const [split, rest] = splitProps(props, [
    "children",
    "shortcut",
    "shortcutAria",
    "shortcutClass",
    "shortcutClassList",
  ])

  return (
    <Button {...rest} aria-keyshortcuts={split.shortcutAria} data-button-shortcut={split.shortcut ? "true" : undefined}>
      <span data-slot="button-shortcut-label">{split.children}</span>
      <Show when={split.shortcut}>
        <span data-slot="button-shortcut-key">
          <Keybind class={split.shortcutClass} classList={split.shortcutClassList}>
            {split.shortcut}
          </Keybind>
        </span>
      </Show>
    </Button>
  )
}
