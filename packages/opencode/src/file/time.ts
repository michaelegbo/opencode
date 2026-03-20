import { runInstance } from "@/effect/run"
import type { SessionID } from "@/session/schema"
import { lazy } from "@/util/lazy"

const svc = lazy(() => import("./time-service").then((m) => m.FileTime.Service))

export namespace FileTime {
  export async function read(sessionID: SessionID, file: string) {
    return runInstance((await svc()).use((s) => s.read(sessionID, file)))
  }

  export async function get(sessionID: SessionID, file: string) {
    return runInstance((await svc()).use((s) => s.get(sessionID, file)))
  }

  export async function assert(sessionID: SessionID, filepath: string) {
    return runInstance((await svc()).use((s) => s.assert(sessionID, filepath)))
  }

  export async function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T> {
    return runInstance((await svc()).use((s) => s.withLock(filepath, fn)))
  }
}
