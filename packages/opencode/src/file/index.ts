import { runInstance } from "@/effect/run"
import { lazy } from "@/util/lazy"
import type { File as S } from "./service"

const svc = lazy(() => import("./service").then((m) => m.File.Service))

export namespace File {
  export async function init() {
    return runInstance((await svc()).use((s) => s.init()))
  }

  export async function status() {
    return runInstance((await svc()).use((s) => s.status()))
  }

  export async function read(file: string): Promise<S.Content> {
    return runInstance((await svc()).use((s) => s.read(file)))
  }

  export async function list(dir?: string) {
    return runInstance((await svc()).use((s) => s.list(dir)))
  }

  export async function search(input: { query: string; limit?: number; dirs?: boolean; type?: "file" | "directory" }) {
    return runInstance((await svc()).use((s) => s.search(input)))
  }
}
