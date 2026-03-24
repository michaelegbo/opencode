/**
 * Mock Runner — Dual Instance Diff
 *
 * Connects to TWO running opencode servers, runs identical mock RPC scripts
 * against both (all turns on A, then all turns on B), and diffs the results.
 * Each session run writes the full serialized messages and a unified diff
 * into a folder under ./errors/<id>/.
 *
 * Usage:
 *   bun run src/provider/sdk/mock/runner/diff.ts <port1> <port2>
 */

import path from "path"
import { connect, generate, run, log, summary, tools, rand, type Message } from "./core"

const port1 = process.argv[2]
const port2 = process.argv[3]

if (!port1 || !port2) {
  console.error("Usage: bun run src/provider/sdk/mock/runner/diff.ts <port1> <port2>")
  process.exit(1)
}

const ERRORS_DIR = path.join(import.meta.dir, "errors")

// ── Normalize ───────────────────────────────────────────────────────────

function normalize(msgs: Message[]): object[] {
  return msgs.map((m) => ({
    role: m.info.role,
    parts: m.parts.map((p) => {
      const { id, sessionID, messageID, ...rest } = p
      if (rest.type === "tool" && rest.state) {
        const { time, ...state } = rest.state
        return { ...rest, state }
      }
      if (rest.type === "step-finish") {
        const { cost, tokens, ...finish } = rest
        return finish
      }
      if ("time" in rest) {
        const { time, ...without } = rest
        return without
      }
      return rest
    }),
  }))
}

// ── Write results ───────────────────────────────────────────────────────

async function writeResults(scripts: { steps: object[][] }[], a: Message[], b: Message[]): Promise<string | false> {
  const na = normalize(a)
  const nb = normalize(b)
  const ja = JSON.stringify(na, null, 2)
  const jb = JSON.stringify(nb, null, 2)

  if (ja === jb) return false

  const id = Math.random().toString(36).slice(2, 10)
  const dir = path.join(ERRORS_DIR, id)

  const fileA = path.join(dir, "normalized_a.json")
  const fileB = path.join(dir, "normalized_b.json")

  await Promise.all([
    Bun.write(path.join(dir, "messages_a.json"), JSON.stringify(a, null, 2)),
    Bun.write(path.join(dir, "messages_b.json"), JSON.stringify(b, null, 2)),
    Bun.write(fileA, ja),
    Bun.write(fileB, jb),
  ])

  // generate unified diff via system `diff`
  const proc = Bun.spawn(["diff", "-u", "--label", "instance_a", fileA, "--label", "instance_b", fileB], {
    stdout: "pipe",
  })
  const patch = await new Response(proc.stdout).text()
  await proc.exited
  await Bun.write(path.join(dir, "diff.patch"), patch)

  return dir
}

// ── Session loop ────────────────────────────────────────────────────────

async function session(a: Awaited<ReturnType<typeof connect>>, b: Awaited<ReturnType<typeof connect>>) {
  const turns = rand(30, 100)
  const scripts = await generate(a.base, turns)

  log(`${turns} turns generated: ${scripts.map((s) => summary(s)).join(", ")}`)

  log(`running ${turns} turns on A...`)
  const msgsA = await run(a, scripts)
  log(`A: ${msgsA.length} messages`)

  log(`running ${turns} turns on B...`)
  const msgsB = await run(b, scripts)
  log(`B: ${msgsB.length} messages`)

  const dir = await writeResults(scripts, msgsA, msgsB)
  if (dir) {
    log(`DIFF → ${dir}`)
  } else {
    log(`OK — no differences`)
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const a = await connect("A", port1)
  const b = await connect("B", port2)

  const t = await tools(a.base)
  log(`${t.length} tools: ${t.map((x) => x.id).join(", ")}`)

  while (true) {
    try {
      await session(a, b)
    } catch (e: any) {
      log(`session failed: ${e.message}`)
      await Bun.sleep(2000)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
