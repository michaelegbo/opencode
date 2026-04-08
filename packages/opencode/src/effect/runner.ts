import { Cause, Deferred, Effect, Exit, Fiber, Option, Schema, Scope, SynchronizedRef } from "effect"

export interface Runner<A, E = never> {
  readonly state: Runner.State<A, E>
  readonly busy: boolean
  readonly queued: number
  readonly ensureRunning: (work: Effect.Effect<A, E>) => Effect.Effect<A, E>
  readonly enqueueRunning: (work: Effect.Effect<A, E>) => Effect.Effect<A, E>
  readonly startShell: (work: (signal: AbortSignal) => Effect.Effect<A, E>) => Effect.Effect<A, E>
  readonly enqueueShell: (work: (signal: AbortSignal) => Effect.Effect<A, E>) => Effect.Effect<A, E>
  readonly cancel: Effect.Effect<void>
}

export namespace Runner {
  export class Cancelled extends Schema.TaggedErrorClass<Cancelled>()("RunnerCancelled", {}) {}

  interface RunHandle<A, E> {
    id: number
    done: Deferred.Deferred<A, E | Cancelled>
    fiber: Fiber.Fiber<A, E>
  }

  interface ShellHandle<A, E> {
    id: number
    done: Deferred.Deferred<A, E | Cancelled>
    fiber: Fiber.Fiber<A, E>
    abort: AbortController
  }

  interface RunItem<A, E> {
    type: "run"
    id: number
    done: Deferred.Deferred<A, E | Cancelled>
    work: Effect.Effect<A, E>
  }

  interface ShellItem<A, E> {
    type: "shell"
    id: number
    done: Deferred.Deferred<A, E | Cancelled>
    work: (signal: AbortSignal) => Effect.Effect<A, E>
  }

  type Item<A, E> = RunItem<A, E> | ShellItem<A, E>
  type Step<A, E> = readonly [Effect.Effect<void>, State<A, E>]

  export type State<A, E> =
    | { readonly _tag: "Idle" }
    | { readonly _tag: "Running"; readonly run: RunHandle<A, E>; readonly queue: Item<A, E>[] }
    | { readonly _tag: "Shell"; readonly shell: ShellHandle<A, E>; readonly queue: Item<A, E>[] }

  export const make = <A, E = never>(
    scope: Scope.Scope,
    opts?: {
      onIdle?: Effect.Effect<void>
      onBusy?: Effect.Effect<void>
      onInterrupt?: Effect.Effect<A, E>
      busy?: () => never
    },
  ): Runner<A, E> => {
    const ref = SynchronizedRef.makeUnsafe<State<A, E>>({ _tag: "Idle" })
    const idle = opts?.onIdle ?? Effect.void
    const busy = opts?.onBusy ?? Effect.void
    const onInterrupt = opts?.onInterrupt
    let ids = 0

    const state = () => SynchronizedRef.getUnsafe(ref)
    const next = () => {
      ids += 1
      return ids
    }

    const awaitDone = (done: Deferred.Deferred<A, E | Cancelled>) =>
      Deferred.await(done).pipe(
        Effect.catch(
          (e): Effect.Effect<A, E> => (e instanceof Cancelled ? (onInterrupt ?? Effect.die(e)) : Effect.fail(e as E)),
        ),
      )

    const complete = (done: Deferred.Deferred<A, E | Cancelled>, exit: Exit.Exit<A, E>) =>
      Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
        ? Deferred.fail(done, new Cancelled()).pipe(Effect.asVoid)
        : Deferred.done(done, exit).pipe(Effect.asVoid)

    const idleIfCurrent = () =>
      SynchronizedRef.modify(ref, (st) => [st._tag === "Idle" ? idle : Effect.void, st] as const).pipe(Effect.flatten)

    const runItem = (work: Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        return {
          type: "run" as const,
          id: next(),
          done: yield* Deferred.make<A, E | Cancelled>(),
          work,
        }
      })

    const shellItem = (work: (signal: AbortSignal) => Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        return {
          type: "shell" as const,
          id: next(),
          done: yield* Deferred.make<A, E | Cancelled>(),
          work,
        }
      })

    const launchRun = (item: RunItem<A, E>): Effect.Effect<RunHandle<A, E>> =>
      Effect.gen(function* () {
        const fiber = yield* item.work.pipe(
          Effect.onExit((exit) => finishRun(item.id, item.done, exit)),
          Effect.forkIn(scope),
        )
        return { id: item.id, done: item.done, fiber } satisfies RunHandle<A, E>
      })

    const launchShell = (item: ShellItem<A, E>): Effect.Effect<ShellHandle<A, E>> =>
      Effect.gen(function* () {
        const abort = new AbortController()
        const fiber = yield* item.work(abort.signal).pipe(
          Effect.onExit((exit) => finishShell(item.id, item.done, exit)),
          Effect.forkChild,
        )
        return {
          id: item.id,
          done: item.done,
          fiber,
          abort,
        } satisfies ShellHandle<A, E>
      })

    const resume = (queue: Item<A, E>[]): Effect.Effect<Step<A, E>> =>
      Effect.gen(function* () {
        const item = queue[0]
        const rest = queue.slice(1)
        if (!item) return [Effect.void, { _tag: "Idle" } as const] as const
        if (item.type === "run") {
          const run = yield* launchRun(item)
          return [Effect.void, { _tag: "Running", run, queue: rest } as const] as const
        }
        const shell = yield* launchShell(item)
        return [Effect.void, { _tag: "Shell", shell, queue: rest } as const] as const
      })

    const finishRun = (
      id: number,
      done: Deferred.Deferred<A, E | Cancelled>,
      exit: Exit.Exit<A, E>,
    ): Effect.Effect<void> =>
      SynchronizedRef.modifyEffect(
        ref,
        (st): Effect.Effect<Step<A, E>> =>
          Effect.gen(function* () {
            const eff = complete(done, exit)
            if (st._tag !== "Running" || st.run.id !== id) return [eff, st] as const
            if (!st.queue.length) return [idle.pipe(Effect.andThen(eff)), { _tag: "Idle" } as const] as const
            const [next, state] = yield* resume(st.queue)
            return [eff.pipe(Effect.andThen(next)), state] as const
          }),
      ).pipe(Effect.flatten)

    const finishShell = (
      id: number,
      done: Deferred.Deferred<A, E | Cancelled>,
      exit: Exit.Exit<A, E>,
    ): Effect.Effect<void> =>
      SynchronizedRef.modifyEffect(
        ref,
        (st): Effect.Effect<Step<A, E>> =>
          Effect.gen(function* () {
            const eff = complete(done, exit)
            if (st._tag !== "Shell" || st.shell.id !== id) return [eff, st] as const
            if (!st.queue.length) return [idle.pipe(Effect.andThen(eff)), { _tag: "Idle" } as const] as const
            const [next, state] = yield* resume(st.queue)
            return [eff.pipe(Effect.andThen(next)), state] as const
          }),
      ).pipe(Effect.flatten)

    const stopShell = (shell: ShellHandle<A, E>) =>
      Effect.gen(function* () {
        shell.abort.abort()
        const exit = yield* Fiber.await(shell.fiber).pipe(Effect.timeoutOption("100 millis"))
        if (Option.isNone(exit)) yield* Fiber.interrupt(shell.fiber)
        yield* Fiber.await(shell.fiber).pipe(Effect.exit, Effect.asVoid)
      })

    const fail = (queue: Item<A, E>[]) =>
      Effect.forEach(
        queue,
        (item) => Deferred.fail(item.done, new Cancelled()).pipe(Effect.asVoid),
        { concurrency: "unbounded", discard: true },
      )

    const ensureRunning = (work: Effect.Effect<A, E>) =>
      SynchronizedRef.modifyEffect(
        ref,
        Effect.fnUntraced(function* (st) {
          switch (st._tag) {
            case "Running":
              return [awaitDone(st.run.done), st] as const
            case "Shell": {
              const item = st.queue.find((item): item is RunItem<A, E> => item.type === "run")
              if (item) return [awaitDone(item.done), st] as const
              const run = yield* runItem(work)
              return [awaitDone(run.done), { ...st, queue: [...st.queue, run] }] as const
            }
            case "Idle": {
              const item = yield* runItem(work)
              const run = yield* launchRun(item)
              return [awaitDone(item.done), { _tag: "Running", run, queue: [] } as const] as const
            }
          }
        }),
      ).pipe(Effect.flatten)

    const enqueueRunning = (work: Effect.Effect<A, E>) =>
      SynchronizedRef.modifyEffect(
        ref,
        Effect.fnUntraced(function* (st) {
          switch (st._tag) {
            case "Idle": {
              const item = yield* runItem(work)
              const run = yield* launchRun(item)
              return [awaitDone(item.done), { _tag: "Running", run, queue: [] } as const] as const
            }
            case "Running":
            case "Shell": {
              const item = yield* runItem(work)
              return [awaitDone(item.done), { ...st, queue: [...st.queue, item] }] as const
            }
          }
        }),
      ).pipe(Effect.flatten)

    const startShell = (work: (signal: AbortSignal) => Effect.Effect<A, E>) =>
      SynchronizedRef.modifyEffect(
        ref,
        Effect.fnUntraced(function* (st) {
          if (st._tag !== "Idle") {
            return [
              Effect.sync(() => {
                if (opts?.busy) opts.busy()
                throw new Error("Runner is busy")
              }),
              st,
            ] as const
          }
          yield* busy
          const item = yield* shellItem(work)
          const shell = yield* launchShell(item)
          return [awaitDone(item.done), { _tag: "Shell", shell, queue: [] } as const] as const
        }),
      ).pipe(Effect.flatten)

    const enqueueShell = (work: (signal: AbortSignal) => Effect.Effect<A, E>) =>
      SynchronizedRef.modifyEffect(
        ref,
        Effect.fnUntraced(function* (st) {
          if (st._tag === "Idle") {
            yield* busy
            const item = yield* shellItem(work)
            const shell = yield* launchShell(item)
            return [awaitDone(item.done), { _tag: "Shell", shell, queue: [] } as const] as const
          }
          const item = yield* shellItem(work)
          return [awaitDone(item.done), { ...st, queue: [...st.queue, item] }] as const
        }),
      ).pipe(Effect.flatten)

    const cancel = SynchronizedRef.modify(ref, (st) => {
      switch (st._tag) {
        case "Idle":
          return [Effect.void, st] as const
        case "Running":
          return [
            Effect.gen(function* () {
              yield* fail(st.queue)
              yield* Fiber.interrupt(st.run.fiber)
              yield* Deferred.await(st.run.done).pipe(Effect.exit, Effect.asVoid)
              yield* idleIfCurrent()
            }),
            { _tag: "Idle" } as const,
          ] as const
        case "Shell":
          return [
            Effect.gen(function* () {
              yield* fail(st.queue)
              yield* stopShell(st.shell)
              yield* Deferred.await(st.shell.done).pipe(Effect.exit, Effect.asVoid)
              yield* idleIfCurrent()
            }),
            { _tag: "Idle" } as const,
          ] as const
      }
    }).pipe(Effect.flatten)

    return {
      get state() {
        return state()
      },
      get busy() {
        return state()._tag !== "Idle"
      },
      get queued() {
        const current = state()
        if (current._tag === "Idle") return 0
        return current.queue.length
      },
      ensureRunning,
      enqueueRunning,
      startShell,
      enqueueShell,
      cancel,
    }
  }
}
