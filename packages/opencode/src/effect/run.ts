import type { Effect } from "effect"
import type { GlobalServices } from "@/effect/runtime"
import type { InstanceServices } from "@/effect/instances"
import { lazy } from "@/util/lazy"

/**
 * Lazy wrappers that defer the import of @/effect/runtime to call time.
 *
 * Adapter modules must not eagerly import @/effect/runtime — or even
 * their own service modules — because bun's bundler can evaluate them
 * before their dependencies have finished initializing.
 */

const runtime = lazy(() => import("@/effect/runtime"))

/** For global services (Auth, Account, etc.) */
export async function run<A, E>(effect: Effect.Effect<A, E, GlobalServices>): Promise<A> {
  return (await runtime()).runtime.runPromise(effect)
}

/** For instance-scoped services (Skill, Snapshot, Question, etc.) */
export async function runInstance<A, E>(effect: Effect.Effect<A, E, InstanceServices>): Promise<A> {
  return (await runtime()).runPromiseInstance(effect)
}
