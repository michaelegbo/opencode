import { expect, mock, spyOn, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { pathToFileURL } from "url"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import type { CliRenderer } from "@opentui/core"
import { tmpdir } from "../../fixture/fixture"
import { Log } from "../../../src/util/log"
import { Global } from "../../../src/global"
import { createPluginKeybind } from "../../../src/cli/cmd/tui/context/keybind-plugin"

mock.module("@opentui/solid/preload", () => ({}))
mock.module("@opentui/solid", () => ({
  createSolidSlotRegistry: () => ({
    register: () => () => {},
  }),
  createSlot: () => () => null,
  useRenderer: () => ({
    getPalette: async () => ({ palette: [] as string[] }),
    clearPaletteCache: () => {},
  }),
}))
mock.module("@opentui/solid/jsx-runtime", () => ({
  Fragment: Symbol.for("Fragment"),
  jsx: () => null,
  jsxs: () => null,
  jsxDEV: () => null,
}))
const { allThemes, addTheme } = await import("../../../src/cli/cmd/tui/context/theme")
const { TuiPlugin } = await import("../../../src/cli/cmd/tui/plugin")
const { PluginMeta } = await import("../../../src/plugin/meta")

async function waitForLog(text: string, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const file = Log.file()
    if (file) {
      const content = await Bun.file(file)
        .text()
        .catch(() => "")
      if (content.includes(text)) return content
    }
    await Bun.sleep(25)
  }
  return Bun.file(Log.file())
    .text()
    .catch(() => "")
}

test("loads plugin theme and keybind APIs with scoped theme installation", async () => {
  const stamp = Date.now()
  const globalConfigPath = path.join(Global.Path.config, "tui.json")
  const backup = await Bun.file(globalConfigPath)
    .text()
    .catch(() => undefined)

  await using tmp = await tmpdir({
    init: async (dir) => {
      const localPluginPath = path.join(dir, "local-plugin.ts")
      const preloadedPluginPath = path.join(dir, "preloaded-plugin.ts")
      const globalPluginPath = path.join(dir, "global-plugin.ts")
      const localSpec = pathToFileURL(localPluginPath).href
      const preloadedSpec = pathToFileURL(preloadedPluginPath).href
      const globalSpec = pathToFileURL(globalPluginPath).href
      const localThemeFile = `local-theme-${stamp}.json`
      const globalThemeFile = `global-theme-${stamp}.json`
      const preloadedThemeFile = `preloaded-theme-${stamp}.json`
      const localThemeName = localThemeFile.replace(/\.json$/, "")
      const globalThemeName = globalThemeFile.replace(/\.json$/, "")
      const preloadedThemeName = preloadedThemeFile.replace(/\.json$/, "")
      const localThemePath = path.join(dir, localThemeFile)
      const globalThemePath = path.join(dir, globalThemeFile)
      const preloadedThemePath = path.join(dir, preloadedThemeFile)
      const localDest = path.join(dir, ".opencode", "themes", localThemeFile)
      const globalDest = path.join(Global.Path.config, "themes", globalThemeFile)
      const preloadedDest = path.join(dir, ".opencode", "themes", preloadedThemeFile)
      const fnMarker = path.join(dir, "function-called.txt")
      const localMarker = path.join(dir, "local-called.json")
      const globalMarker = path.join(dir, "global-called.json")
      const preloadedMarker = path.join(dir, "preloaded-called.json")
      const localConfigPath = path.join(dir, "tui.json")

      await Bun.write(localThemePath, JSON.stringify({ theme: { primary: "#101010" } }, null, 2))
      await Bun.write(globalThemePath, JSON.stringify({ theme: { primary: "#202020" } }, null, 2))
      await Bun.write(preloadedThemePath, JSON.stringify({ theme: { primary: "#f0f0f0" } }, null, 2))
      await Bun.write(preloadedDest, JSON.stringify({ theme: { primary: "#303030" } }, null, 2))

      await Bun.write(
        localPluginPath,
        `export default async (_input, options) => {
  if (!options?.fn_marker) return
  await Bun.write(options.fn_marker, "called")
}

export const object_plugin = {
  tui: async (input, options, init) => {
    if (!options?.marker) return
    const key = input.api.keybind.create(
      { modal: "ctrl+shift+m", screen: "ctrl+shift+o", close: "escape" },
      options.keybinds,
    )
    const depth_before = input.api.ui.dialog.depth
    const open_before = input.api.ui.dialog.open
    const size_before = input.api.ui.dialog.size
    input.api.ui.dialog.setSize("large")
    const size_after = input.api.ui.dialog.size
    input.api.ui.dialog.replace(() => null)
    const depth_after = input.api.ui.dialog.depth
    const open_after = input.api.ui.dialog.open
    input.api.ui.dialog.clear()
    const open_clear = input.api.ui.dialog.open
    const before = input.api.theme.has(options.theme_name)
    const set_missing = input.api.theme.set(options.theme_name)
    await input.api.theme.install(options.theme_path)
    const after = input.api.theme.has(options.theme_name)
    const set_installed = input.api.theme.set(options.theme_name)
    const first = await Bun.file(options.dest).text()
    await Bun.write(options.source, JSON.stringify({ theme: { primary: "#fefefe" } }, null, 2))
    await input.api.theme.install(options.theme_path)
    const second = await Bun.file(options.dest).text()
    const init_state = init?.state ?? null
    const init_first = init?.first ?? null
    const init_updated = init?.updated ?? null
    const init_source = init?.entry?.source ?? null
    const init_load_count = init?.entry?.load_count ?? null
    await Bun.write(
      options.marker,
      JSON.stringify({
        before,
        set_missing,
        after,
        set_installed,
        selected: input.api.theme.selected,
        same: first === second,
        key_modal: key.get("modal"),
        key_close: key.get("close"),
        key_unknown: key.get("ctrl+k"),
        key_print: key.print("modal"),
        depth_before,
        open_before,
        size_before,
        size_after,
        depth_after,
        open_after,
        open_clear,
        init_state,
        init_first,
        init_updated,
        init_source,
        init_load_count,
      }),
    )
  },
}
`,
      )

      await Bun.write(
        preloadedPluginPath,
        `export default {
  tui: async (input, options, init) => {
    if (!options?.marker) return
    const before = input.api.theme.has(options.theme_name)
    await input.api.theme.install(options.theme_path)
    const after = input.api.theme.has(options.theme_name)
    const text = await Bun.file(options.dest).text()
    await Bun.write(
      options.marker,
      JSON.stringify({
        before,
        after,
        text,
        init_state: init?.state ?? null,
        init_first: init?.first ?? null,
        init_updated: init?.updated ?? null,
        init_source: init?.entry?.source ?? null,
        init_load_count: init?.entry?.load_count ?? null,
      }),
    )
  },
}
`,
      )

      await Bun.write(
        globalPluginPath,
        `export default {
  tui: async (input, options, init) => {
    if (!options?.marker) return
    await input.api.theme.install(options.theme_path)
    const has = input.api.theme.has(options.theme_name)
    const set_installed = input.api.theme.set(options.theme_name)
    await Bun.write(
      options.marker,
      JSON.stringify({
        has,
        set_installed,
        selected: input.api.theme.selected,
        init_state: init?.state ?? null,
        init_first: init?.first ?? null,
        init_updated: init?.updated ?? null,
        init_source: init?.entry?.source ?? null,
        init_load_count: init?.entry?.load_count ?? null,
      }),
    )
  },
}
`,
      )

      await Bun.write(
        globalConfigPath,
        JSON.stringify(
          {
            plugin: [
              [globalSpec, { marker: globalMarker, theme_path: `./${globalThemeFile}`, theme_name: globalThemeName }],
            ],
          },
          null,
          2,
        ),
      )

      await Bun.write(
        localConfigPath,
        JSON.stringify(
          {
            plugin: [
              [
                localSpec,
                {
                  fn_marker: fnMarker,
                  marker: localMarker,
                  source: localThemePath,
                  dest: localDest,
                  theme_path: `./${localThemeFile}`,
                  theme_name: localThemeName,
                  keybinds: {
                    modal: "ctrl+alt+m",
                    close: "q",
                  },
                },
              ],
              [
                preloadedSpec,
                {
                  marker: preloadedMarker,
                  dest: preloadedDest,
                  theme_path: `./${preloadedThemeFile}`,
                  theme_name: preloadedThemeName,
                },
              ],
            ],
          },
          null,
          2,
        ),
      )

      return {
        localThemeFile,
        globalThemeFile,
        preloadedThemeFile,
        localThemeName,
        globalThemeName,
        preloadedThemeName,
        localDest,
        globalDest,
        preloadedDest,
        localPluginPath,
        globalPluginPath,
        preloadedPluginPath,
        localSpec,
        globalSpec,
        preloadedSpec,
        fnMarker,
        localMarker,
        globalMarker,
        preloadedMarker,
      }
    },
  })
  process.env.OPENCODE_PLUGIN_META_FILE = path.join(tmp.path, "plugin-meta.json")
  if (!process.env.OPENCODE_PLUGIN_META_FILE) throw new Error("missing meta file")
  await PluginMeta.touch(tmp.extra.localSpec, tmp.extra.localSpec)
  await PluginMeta.touch(tmp.extra.globalSpec, tmp.extra.globalSpec)
  await PluginMeta.persist()
  await Bun.sleep(20)
  const text = await Bun.file(tmp.extra.globalPluginPath).text()
  await Bun.write(tmp.extra.globalPluginPath, `${text}\n`)

  const cwd = spyOn(process, "cwd").mockImplementation(() => tmp.path)
  let selected = "opencode"
  let depth = 0
  let size: "medium" | "large" = "medium"

  const renderer = {
    ...Object.create(null),
    once(this: CliRenderer) {
      return this
    },
  } satisfies CliRenderer
  const keybind = {
    parse: (evt: { name?: string; ctrl?: boolean; meta?: boolean; shift?: boolean; super?: boolean }) => ({
      name: evt.name ?? "",
      ctrl: evt.ctrl ?? false,
      meta: evt.meta ?? false,
      shift: evt.shift ?? false,
      super: evt.super,
      leader: false,
    }),
    match: () => false,
    print: (key: string) => `print:${key}`,
  }

  try {
    expect(addTheme(tmp.extra.preloadedThemeName, { theme: { primary: "#303030" } })).toBe(true)

    await TuiPlugin.init({
      client: createOpencodeClient({
        baseUrl: "http://localhost:4096",
      }),
      event: {
        on: () => () => {},
      },
      renderer,
      api: {
        command: {
          register: () => {},
          trigger: () => {},
        },
        route: {
          register: () => () => {},
          navigate: () => {},
          get current() {
            return { name: "home" as const }
          },
        },
        ui: {
          Dialog: () => null,
          DialogAlert: () => null,
          DialogConfirm: () => null,
          DialogPrompt: () => null,
          DialogSelect: () => null,
          toast: () => {},
          dialog: {
            replace: () => {
              depth = 1
            },
            clear: () => {
              depth = 0
              size = "medium"
            },
            setSize: (next) => {
              size = next
            },
            get size() {
              return size
            },
            get depth() {
              return depth
            },
            get open() {
              return depth > 0
            },
          },
        },
        keybind: {
          ...keybind,
          create(defaults, overrides) {
            return createPluginKeybind(keybind, defaults, overrides)
          },
        },
        theme: {
          get current() {
            return {}
          },
          get selected() {
            return selected
          },
          has(name) {
            return allThemes()[name] !== undefined
          },
          set(name) {
            if (!allThemes()[name]) return false
            selected = name
            return true
          },
          async install() {
            throw new Error("base theme.install should not run")
          },
          mode() {
            return "dark" as const
          },
          get ready() {
            return true
          },
        },
      },
    })

    const local = JSON.parse(await fs.readFile(tmp.extra.localMarker, "utf8"))
    expect(local.before).toBe(false)
    expect(local.set_missing).toBe(false)
    expect(local.after).toBe(true)
    expect(local.set_installed).toBe(true)
    expect(local.selected).toBe(tmp.extra.localThemeName)
    expect(local.same).toBe(true)
    expect(local.key_modal).toBe("ctrl+alt+m")
    expect(local.key_close).toBe("q")
    expect(local.key_unknown).toBe("ctrl+k")
    expect(local.key_print).toBe("print:ctrl+alt+m")
    expect(local.depth_before).toBe(0)
    expect(local.open_before).toBe(false)
    expect(local.size_before).toBe("medium")
    expect(local.size_after).toBe("large")
    expect(local.depth_after).toBe(1)
    expect(local.open_after).toBe(true)
    expect(local.open_clear).toBe(false)
    expect(local.init_state).toBe("same")
    expect(local.init_first).toBe(false)
    expect(local.init_updated).toBe(false)
    expect(local.init_source).toBe("file")
    expect(local.init_load_count).toBe(2)

    const global = JSON.parse(await fs.readFile(tmp.extra.globalMarker, "utf8"))
    expect(global.has).toBe(true)
    expect(global.set_installed).toBe(true)
    expect(global.selected).toBe(tmp.extra.globalThemeName)
    expect(global.init_state).toBe("changed")
    expect(global.init_first).toBe(false)
    expect(global.init_updated).toBe(true)
    expect(global.init_source).toBe("file")
    expect(global.init_load_count).toBe(2)

    const preloaded = JSON.parse(await fs.readFile(tmp.extra.preloadedMarker, "utf8"))
    expect(preloaded.before).toBe(true)
    expect(preloaded.after).toBe(true)
    expect(preloaded.text).toContain("#303030")
    expect(preloaded.text).not.toContain("#f0f0f0")
    expect(preloaded.init_state).toBe("new")
    expect(preloaded.init_first).toBe(true)
    expect(preloaded.init_updated).toBe(false)
    expect(preloaded.init_source).toBe("file")
    expect(preloaded.init_load_count).toBe(1)

    await expect(fs.readFile(tmp.extra.fnMarker, "utf8")).rejects.toThrow()

    const localInstalled = await fs.readFile(tmp.extra.localDest, "utf8")
    expect(localInstalled).toContain("#101010")
    expect(localInstalled).not.toContain("#fefefe")

    const globalInstalled = await fs.readFile(tmp.extra.globalDest, "utf8")
    expect(globalInstalled).toContain("#202020")

    const preloadedInstalled = await fs.readFile(tmp.extra.preloadedDest, "utf8")
    expect(preloadedInstalled).toContain("#303030")
    expect(preloadedInstalled).not.toContain("#f0f0f0")

    expect(
      await fs
        .stat(path.join(Global.Path.config, "themes", tmp.extra.localThemeFile))
        .then(() => true)
        .catch(() => false),
    ).toBe(false)
    expect(
      await fs
        .stat(path.join(tmp.path, ".opencode", "themes", tmp.extra.globalThemeFile))
        .then(() => true)
        .catch(() => false),
    ).toBe(false)

    const log = await waitForLog("ignoring non-object tui plugin export")
    expect(log).toContain("ignoring non-object tui plugin export")
    expect(log).toContain("name=default")
    expect(log).toContain("type=function")

    const meta = JSON.parse(await fs.readFile(path.join(tmp.path, "plugin-meta.json"), "utf8")) as Record<
      string,
      { name: string; load_count: number }
    >
    const rows = Object.values(meta)
    expect(rows.find((item) => item.name === "local-plugin")?.load_count).toBe(2)
    expect(rows.find((item) => item.name === "global-plugin")?.load_count).toBe(2)
    expect(rows.find((item) => item.name === "preloaded-plugin")?.load_count).toBe(1)
  } finally {
    cwd.mockRestore()
    if (backup === undefined) {
      await fs.rm(globalConfigPath, { force: true })
    } else {
      await Bun.write(globalConfigPath, backup)
    }
    await fs.rm(tmp.extra.globalDest, { force: true }).catch(() => {})
    delete process.env.OPENCODE_PLUGIN_META_FILE
  }
})
