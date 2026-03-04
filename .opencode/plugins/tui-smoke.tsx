import mytheme from "../themes/mytheme.json" with { type: "json" }

const slot = (label) => ({
  id: "workspace-smoke",
  slots: {
    home_logo() {
      return <text>plugin logo:{label}</text>
    },
    sidebar_top(_ctx, props) {
      return (
        <text>
          plugin:{label} session:{props.session_id.slice(0, 8)}
        </text>
      )
    },
  },
})

const themes = {
  "workspace-plugin-smoke": mytheme,
}

const tui = async (input, options) => {
  if (options?.enabled === false) return
  const label = typeof options?.label === "string" ? options.label : "smoke"
  input.slots.register(slot(label))
}

export default {
  themes,
  tui,
}
