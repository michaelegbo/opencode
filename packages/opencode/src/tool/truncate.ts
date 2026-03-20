import type { Agent } from "../agent/agent"
import type { Truncate as S } from "./truncate-effect"
import { run } from "@/effect/run"
import { lazy } from "@/util/lazy"

const svc = lazy(() => import("./truncate-effect").then((m) => m.Truncate.Service))

export namespace Truncate {
  export async function output(text: string, options: S.Options = {}, agent?: Agent.Info): Promise<S.Result> {
    return run((await svc()).use((s) => s.output(text, options, agent)))
  }
}
