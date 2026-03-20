import { runInstance } from "@/effect/run"
import { lazy } from "@/util/lazy"
import type { Permission } from "./service"

const svc = lazy(() => import("./service").then((m) => m.Permission.Service))

export namespace PermissionNext {
  export async function ask(input: Permission.AskInput) {
    return runInstance((await svc()).use((s) => s.ask(input)))
  }

  export async function reply(input: Permission.ReplyInput) {
    return runInstance((await svc()).use((s) => s.reply(input)))
  }

  export async function list() {
    return runInstance((await svc()).use((s) => s.list()))
  }
}
