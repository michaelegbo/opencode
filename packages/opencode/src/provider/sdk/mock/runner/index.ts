/**
 * Mock Runner — Single Instance (Log Mode)
 *
 * Connects to one running opencode server, sends mock RPC scripts,
 * and logs all user/assistant messages per turn.
 *
 * Usage:
 *   bun run src/provider/sdk/mock/runner/index.ts <port>
 */

import {
  connect,
  generate,
  run,
  log,
  summary,
  logMessages,
  tools,
  rand,
  api,
  idle,
  messages,
  type Message,
} from "./core"

const port = process.argv[2] || 4096;

async function session(inst: Awaited<ReturnType<typeof connect>>) {
  const info = await api<{ id: string }>(inst.base, "POST", "/session", {})
  const sid = info.id
  const turns = rand(30, 100)
  const history: Message[] = []

  log(`session ${sid} — ${turns} turns`)

  const scripts = await generate(inst.base, turns)

  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i]
    const payload = JSON.stringify(s)
    log(`  [${i + 1}/${turns}] ${summary(s)}`)

    try {
      await api(inst.base, "POST", `/session/${sid}/prompt_async`, {
        parts: [{ type: "text", text: payload }],
        model: { providerID: "mock", modelID: "mock-model" },
      })
      await idle(sid, inst.sse)

      const all = await messages(inst.base, sid)
      const known = new Set(history.map((m) => m.info.id))
      const fresh = all.filter((m) => !known.has(m.info.id))

      log(`  → ${fresh.length} new message(s):`)
      logMessages(fresh)

      history.push(...fresh)
    } catch (e: any) {
      log(`  error on turn ${i + 1}: ${e.message}`)
      await Bun.sleep(1000)
      await api(inst.base, "POST", `/session/${sid}/abort`).catch(() => {})
      await Bun.sleep(500)
    }
  }

  log(`session ${sid} — done (${history.length} messages total)`)
}

async function main() {
  const inst = await connect("server", port)

  const t = await tools(inst.base)
  log(`${t.length} tools: ${t.map((x) => x.id).join(", ")}`)

  while (true) {
    try {
      await session(inst)
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
