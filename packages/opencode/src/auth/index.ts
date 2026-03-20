import z from "zod"
import { run } from "@/effect/run"
import { lazy } from "@/util/lazy"

export { OAUTH_DUMMY_KEY } from "./effect"

const svc = lazy(() => import("./effect").then((m) => m.Auth.Service))

export namespace Auth {
  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
      accountId: z.string().optional(),
      enterpriseUrl: z.string().optional(),
    })
    .meta({ ref: "OAuth" })

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
    })
    .meta({ ref: "ApiAuth" })

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    .meta({ ref: "WellKnownAuth" })

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  export async function get(providerID: string) {
    return run((await svc()).use((s) => s.get(providerID)))
  }

  export async function all(): Promise<Record<string, Info>> {
    return run((await svc()).use((s) => s.all()))
  }

  export async function set(key: string, info: Info) {
    return run((await svc()).use((s) => s.set(key, info)))
  }

  export async function remove(key: string) {
    return run((await svc()).use((s) => s.remove(key)))
  }
}
