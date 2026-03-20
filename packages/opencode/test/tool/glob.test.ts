import { describe, expect, test } from "bun:test"
import path from "path"
import { GlobTool } from "../../src/tool/glob"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"
import { SessionID, MessageID } from "../../src/session/schema"

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make(""),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

describe("tool.glob", () => {
  test("finds files by glob pattern", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "src", "foo.ts"), "export const foo = 1\n")
        await Bun.write(path.join(dir, "src", "bar.ts"), "export const bar = 1\n")
        await Bun.write(path.join(dir, "src", "baz.js"), "export const baz = 1\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const glob = await GlobTool.init()
        const result = await glob.execute(
          {
            pattern: "*.ts",
            path: tmp.path,
          },
          ctx,
        )

        expect(result.metadata.count).toBe(2)
        expect(result.output).toContain(path.join(tmp.path, "src", "foo.ts"))
        expect(result.output).toContain(path.join(tmp.path, "src", "bar.ts"))
      },
    })
  })

  test("returns no files found for unmatched patterns", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "src", "foo.ts"), "export const foo = 1\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const glob = await GlobTool.init()
        const result = await glob.execute(
          {
            pattern: "*.py",
            path: tmp.path,
          },
          ctx,
        )

        expect(result.metadata.count).toBe(0)
        expect(result.output).toBe("No files found")
      },
    })
  })

  test("falls back for brace glob patterns", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "src", "foo.ts"), "export const foo = 1\n")
        await Bun.write(path.join(dir, "src", "bar.js"), "export const bar = 1\n")
        await Bun.write(path.join(dir, "src", "baz.py"), "print('baz')\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const glob = await GlobTool.init()
        const result = await glob.execute(
          {
            pattern: "*.{ts,js}",
            path: tmp.path,
          },
          ctx,
        )

        expect(result.metadata.count).toBe(2)
        expect(result.output).toContain(path.join(tmp.path, "src", "foo.ts"))
        expect(result.output).toContain(path.join(tmp.path, "src", "bar.js"))
      },
    })
  })
})
