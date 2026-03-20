# Effect patterns

Practical reference for new and migrated Effect code in `packages/opencode`.

## Choose scope

Use the shared runtime for process-wide services with one lifecycle for the whole app.

Use `src/effect/instances.ts` for services that are created per directory or need `InstanceContext`, per-project state, or per-instance cleanup.

- Shared runtime: config readers, stateless helpers, global clients
- Instance-scoped: watchers, per-project caches, session state, project-bound background work

Rule of thumb: if two open directories should not share one copy of the service, it belongs in `Instances`.

## Service shape

For a fully migrated module, use the public namespace directly:

```ts
export namespace Foo {
  export interface Interface {
    readonly get: (id: FooID) => Effect.Effect<FooInfo, FooError>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Foo") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      return Service.of({
        get: Effect.fn("Foo.get")(function* (id) {
          return yield* ...
        }),
      })
    }),
  )

  export const defaultLayer = layer.pipe(Layer.provide(FooRepo.defaultLayer))
}
```

Rules:

- Keep `Interface`, `Service`, `layer`, and `defaultLayer` on the owning namespace
- Export `defaultLayer` only when wiring dependencies is useful
- Use the direct namespace form once the module is fully migrated

## Service / Facade split

Migrated services are split into two files:

- **Service module** (`service.ts`, `*-service.ts`, or `*-effect.ts`) — contains `Interface`, `Service`, `layer`, `defaultLayer`, schemas, types, errors, and pure helpers. Must **never** import `@/effect/runtime`.
- **Facade** (`index.ts`) — thin async wrapper that calls `runInstance()` or `run()` from `@/effect/run`. Contains **only** runtime-backed convenience functions. No re-exports of schemas, types, Service, layer, or anything else.

### Facade rules (critical for bundle safety)

1. **No eager import of `@/effect/runtime`** — use `run()` / `runInstance()` from `@/effect/run` instead, which lazy-imports the runtime.
2. **No eager import of the service module** if the service is in the circular dependency SCC (auth, account, skill, truncate). Use the lazy `svc()` pattern:
   ```ts
   const svc = () => import("./service").then((m) => m.Foo.Service)
   ```
3. **No value re-exports** — consumers that need schemas, types, `Service`, or `layer` import from the service module directly.
4. **Only async wrapper functions** — each function awaits `svc()` and passes an Effect to `run()` / `runInstance()`.

### Why

Bun's bundler flattens all modules into a single file. When a circular dependency exists (`runtime → instances → services → config → auth → runtime`), the bundler picks an arbitrary evaluation order. If a facade eagerly imports `@/effect/runtime` or re-exports values from a service in the SCC, those values may be `undefined` when accessed at module load time — causing `undefined is not an object` crashes.

The lazy `svc()` + `run()` pattern defers all access to call time, when all modules have finished initializing.

### Example facade

```ts
// src/question/index.ts (facade)
import { runInstance } from "@/effect/run"
import type { Question as S } from "./service"

const svc = () => import("./service").then((m) => m.Question.Service)

export namespace Question {
  export async function ask(input: { ... }): Promise<S.Answer[]> {
    return runInstance((await svc()).use((s) => s.ask(input)))
  }

  export async function list() {
    return runInstance((await svc()).use((s) => s.list()))
  }
}
```

### Current facades

| Facade | Service module | Scope |
|---|---|---|
| `src/question/index.ts` | `src/question/service.ts` | instance |
| `src/permission/index.ts` | `src/permission/service.ts` | instance |
| `src/format/index.ts` | `src/format/service.ts` | instance |
| `src/file/index.ts` | `src/file/service.ts` | instance |
| `src/file/time.ts` | `src/file/time-service.ts` | instance |
| `src/provider/auth.ts` | `src/provider/auth-service.ts` | instance |
| `src/skill/index.ts` | `src/skill/service.ts` | instance |
| `src/snapshot/index.ts` | `src/snapshot/service.ts` | instance |
| `src/auth/index.ts` | `src/auth/effect.ts` | global |
| `src/account/index.ts` | `src/account/effect.ts` | global |
| `src/tool/truncate.ts` | `src/tool/truncate-effect.ts` | global |

## Scheduled Tasks

For loops or periodic work, use `Effect.repeat` or `Effect.schedule` with `Effect.forkScoped` in the layer definition.

## Preferred Effect services

In effectified services, prefer yielding existing Effect services over dropping down to ad hoc platform APIs.

Prefer these first:

- `FileSystem.FileSystem` instead of raw `fs/promises` for effectful file I/O
- `ChildProcessSpawner.ChildProcessSpawner` with `ChildProcess.make(...)` instead of custom process wrappers
- `HttpClient.HttpClient` instead of raw `fetch`
- `Path.Path` instead of mixing path helpers into service code when you already need a path service
- `Config` for effect-native configuration reads
- `Clock` / `DateTime` for time reads inside effects

## Child processes

For child process work in services, yield `ChildProcessSpawner.ChildProcessSpawner` in the layer and use `ChildProcess.make(...)`.

Keep shelling-out code inside the service, not in callers.

## Shared leaf models

Shared schema or model files can stay outside the service namespace when lower layers also depend on them.

That is fine for leaf files like `schema.ts`. Keep the service surface in the owning namespace.

## Migration checklist

Done now:

- [x] `AccountEffect` (mixed-mode)
- [x] `AuthEffect` (mixed-mode)
- [x] `TruncateEffect` (mixed-mode)
- [x] `Question`
- [x] `PermissionNext`
- [x] `ProviderAuth`
- [x] `FileWatcher`
- [x] `FileTime`
- [x] `Format`
- [x] `Vcs`
- [x] `Skill`
- [x] `Discovery`
- [x] `File`
- [x] `Snapshot`

Still open and likely worth migrating:

- [ ] `Plugin`
- [ ] `ToolRegistry`
- [ ] `Pty`
- [ ] `Worktree`
- [ ] `Installation`
- [ ] `Bus`
- [ ] `Command`
- [ ] `Config`
- [ ] `Session`
- [ ] `SessionProcessor`
- [ ] `SessionPrompt`
- [ ] `SessionCompaction`
- [ ] `Provider`
- [ ] `Project`
- [ ] `LSP`
- [ ] `MCP`
