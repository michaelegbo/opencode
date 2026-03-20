import { runInstance } from "@/effect/run"
import { lazy } from "@/util/lazy"

const svc = lazy(() => import("./service").then((m) => m.Format.Service))

export namespace Format {
  export async function status() {
    return runInstance((await svc()).use((s) => s.status()))
  }
}
