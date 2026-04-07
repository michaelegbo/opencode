// @ts-nocheck
import { ButtonShortcut } from "./button-shortcut"

const docs = `### Overview
Button with a trailing shortcut keycap.

Use this when the action label and shortcut should be taught together at the control level.

### API
- Inherits Button props.
- \`shortcut\`: visible keycap text.
- \`shortcutAria\`: semantic shortcut string for \`aria-keyshortcuts\`.
- \`shortcutClass\`: optional class override for the keycap.

### Variants and states
- Uses the same \`variant\` and \`size\` options as \`Button\`.
- Supports disabled state.

### Accessibility
- Keep the visible shortcut concise.
- Use \`shortcutAria\` for the canonical key sequence when it differs from the visible label.

### Theming/tokens
- Extends \`Button\` and composes \`Keybind\`.

`

export default {
  title: "UI/ButtonShortcut",
  id: "components-button-shortcut",
  component: ButtonShortcut,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: docs,
      },
    },
  },
  args: {
    children: "Cancel",
    shortcut: "Esc",
    shortcutAria: "Escape",
    variant: "ghost",
    size: "small",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost"],
    },
    size: {
      control: "select",
      options: ["small", "normal", "large"],
    },
  },
}

export const Basic = {}

export const Sizes = {
  render: () => (
    <div style={{ display: "flex", gap: "12px", "align-items": "center" }}>
      <ButtonShortcut size="small" variant="ghost" shortcut="Esc" shortcutAria="Escape">
        Cancel
      </ButtonShortcut>
      <ButtonShortcut size="normal" variant="secondary" shortcut="Tab" shortcutAria="Tab">
        Focus
      </ButtonShortcut>
      <ButtonShortcut size="large" variant="primary" shortcut="Enter" shortcutAria="Enter">
        Submit
      </ButtonShortcut>
    </div>
  ),
}

export const Shell = {
  args: {
    children: "Cancel",
    shortcut: "Esc",
    shortcutAria: "Escape",
    variant: "ghost",
    size: "small",
    class: "h-6 gap-2 rounded-[6px] border-none px-0 py-0 pl-3 pr-0.75 text-13-medium text-text-base shadow-none",
  },
}
