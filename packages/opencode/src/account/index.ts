import { Option } from "effect"
import { run } from "@/effect/run"
import { lazy } from "@/util/lazy"
import { type AccessToken, AccountID, Info as Model, OrgID } from "./effect"

export { AccessToken, AccountID, OrgID } from "./effect"

const svc = lazy(() => import("./effect").then((m) => m.Account.Service))

export namespace Account {
  export const Info = Model
  export type Info = Model

  export async function active(): Promise<Info | undefined> {
    return Option.getOrUndefined(await run((await svc()).use((s) => s.active())))
  }

  export async function config(accountID: AccountID, orgID: OrgID): Promise<Record<string, unknown> | undefined> {
    const config = await run((await svc()).use((s) => s.config(accountID, orgID)))
    return Option.getOrUndefined(config)
  }

  export async function token(accountID: AccountID): Promise<AccessToken | undefined> {
    const token = await run((await svc()).use((s) => s.token(accountID)))
    return Option.getOrUndefined(token)
  }
}
