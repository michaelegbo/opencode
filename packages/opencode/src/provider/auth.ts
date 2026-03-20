import { runInstance } from "@/effect/run"
import { lazy } from "@/util/lazy"
import type { ProviderAuth as S } from "./auth-service"
import type { ProviderID } from "./schema"

const svc = lazy(() => import("./auth-service").then((m) => m.ProviderAuth.Service))

export namespace ProviderAuth {
  export async function methods() {
    return runInstance((await svc()).use((s) => s.methods()))
  }

  export async function authorize(input: {
    providerID: ProviderID
    method: number
    inputs?: Record<string, string>
  }): Promise<S.Authorization | undefined> {
    return runInstance((await svc()).use((s) => s.authorize(input)))
  }

  export async function callback(input: { providerID: ProviderID; method: number; code?: string }) {
    return runInstance((await svc()).use((s) => s.callback(input)))
  }
}
