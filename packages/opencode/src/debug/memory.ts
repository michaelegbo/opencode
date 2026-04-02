import { Global } from "@/global"
import { Installation } from "@/installation"
import { stats } from "@/util/queue"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { appendFile, mkdir } from "fs/promises"
import { writeHeapSnapshot } from "node:v8"
import path from "path"

const log = Log.create({ service: "memory" })

const root = process.env.OPENCODE_DEBUG_DIR ?? path.join(Global.Path.state, "debug")
const file = path.join(root, "memory.jsonl")
const snap = path.join(root, "snapshots")

export namespace Memory {
  export function start(name: string) {
    if (!Installation.isLocal()) return () => {}

    let busy = false
    let last = 0
    const every = num("OPENCODE_DEBUG_MEMORY_INTERVAL_MS") ?? 10_000
    const limit = (num("OPENCODE_DEBUG_MEMORY_RSS_MB") ?? 1_500) * 1024 * 1024
    const cool = num("OPENCODE_DEBUG_MEMORY_COOLDOWN_MS") ?? 5 * 60 * 1000

    const tick = async (kind: "start" | "sample") => {
      if (busy) return
      busy = true

      try {
        const now = Date.now()
        const mem = process.memoryUsage()
        const q = stats()
          .filter((item) => item.size > 0 || item.max > 0)
          .sort((a, b) => b.size - a.size || b.max - a.max)
          .slice(0, 10)
        const row = {
          kind: "sample",
          time: new Date(now).toISOString(),
          name,
          pid: process.pid,
          rss: mem.rss,
          heap: mem.heapUsed,
          ext: mem.external,
          buf: mem.arrayBuffers,
          queues: q,
        }

        await line(row)

        if (kind === "start" || mem.rss < limit || now - last < cool) return

        last = now
        const tag = stamp(now)
        const heap = path.join(snap, `${tag}-${name}.heapsnapshot`)
        await mkdir(snap, { recursive: true })
        writeHeapSnapshot(heap)

        const meta = {
          kind: "snapshot",
          time: row.time,
          name,
          pid: process.pid,
          trigger: {
            type: "rss",
            limit,
            value: mem.rss,
          },
          memory: mem,
          queues: q,
        }

        await Filesystem.writeJson(path.join(snap, `${tag}-${name}.json`), meta)
        await line({ ...meta, heap })
        log.warn("memory snapshot written", {
          name,
          pid: process.pid,
          rss_mb: mb(mem.rss),
          limit_mb: mb(limit),
          heap,
        })
      } catch (err) {
        log.warn("memory monitor failed", {
          name,
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        busy = false
      }
    }

    const timer = setInterval(() => {
      void tick("sample")
    }, every)
    timer.unref?.()
    void tick("start")

    return () => {
      clearInterval(timer)
    }
  }
}

async function line(input: unknown) {
  await mkdir(root, { recursive: true })
  await appendFile(file, JSON.stringify(input) + "\n")
}

function num(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function mb(value: number) {
  return Math.round((value / 1024 / 1024) * 10) / 10
}

function stamp(now: number) {
  return new Date(now).toISOString().replaceAll(":", "-").replaceAll(".", "-")
}
