import { runInstance } from "@/effect/run"
import { lazy } from "@/util/lazy"
import type { Snapshot as S } from "./service"

const svc = lazy(() => import("./service").then((m) => m.Snapshot.Service))

export namespace Snapshot {
  export async function cleanup() {
    return runInstance((await svc()).use((s) => s.cleanup()))
  }

  export async function track() {
    return runInstance((await svc()).use((s) => s.track()))
  }

  export async function patch(hash: string) {
    return runInstance((await svc()).use((s) => s.patch(hash)))
  }

  export async function restore(snapshot: string) {
    return runInstance((await svc()).use((s) => s.restore(snapshot)))
  }

  export async function revert(patches: S.Patch[]) {
    return runInstance((await svc()).use((s) => s.revert(patches)))
  }

  export async function diff(hash: string) {
    return runInstance((await svc()).use((s) => s.diff(hash)))
  }

  export async function diffFull(from: string, to: string) {
    return runInstance((await svc()).use((s) => s.diffFull(from, to)))
  }
}
