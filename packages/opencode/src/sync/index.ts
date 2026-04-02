import z from "zod"
import type { ZodObject } from "zod"
import { EventEmitter } from "events"
import { Effect, Layer, ServiceMap } from "effect"
import { makeRuntime } from "@/effect/run-service"
import { Database, eq } from "@/storage/db"
import { Bus as ProjectBus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { EventSequenceTable, EventTable } from "./event.sql"
import { EventID } from "./schema"
import { Flag } from "@/flag/flag"

export namespace SyncEvent {
  export type Definition = {
    type: string
    version: number
    aggregate: string
    schema: z.ZodObject

    // This is temporary and only exists for compatibility with bus
    // event definitions
    properties: z.ZodObject
  }

  export type Event<Def extends Definition = Definition> = {
    id: string
    seq: number
    aggregateID: string
    data: z.infer<Def["schema"]>
  }

  export type SerializedEvent<Def extends Definition = Definition> = Event<Def> & { type: string }

  type ProjectorFunc = (db: Database.TxOrDb, data: unknown) => void

  type State = {
    projectors: Map<Definition, ProjectorFunc> | undefined
    convert: (type: string, event: Event["data"]) => Promise<Record<string, unknown>> | Record<string, unknown>
    bus: EventEmitter<{ event: [{ def: Definition; event: Event }] }>
  }

  export const registry = new Map<string, Definition>()
  const versions = new Map<string, number>()
  let frozen = false

  function noop(_: string, data: Event["data"]) {
    return data
  }

  export function versionedType<A extends string>(type: A): A
  export function versionedType<A extends string, B extends number>(type: A, version: B): `${A}/${B}`
  export function versionedType(type: string, version?: number) {
    return version ? `${type}.${version}` : type
  }

  export function define<
    Type extends string,
    Agg extends string,
    Schema extends ZodObject<Record<Agg, z.ZodType<string>>>,
    BusSchema extends ZodObject = Schema,
  >(input: { type: Type; version: number; aggregate: Agg; schema: Schema; busSchema?: BusSchema }) {
    if (frozen) {
      throw new Error("Error defining sync event: sync system has been frozen")
    }

    const def = {
      type: input.type,
      version: input.version,
      aggregate: input.aggregate,
      schema: input.schema,
      properties: input.busSchema ? input.busSchema : input.schema,
    }

    versions.set(def.type, Math.max(def.version, versions.get(def.type) || 0))

    registry.set(versionedType(def.type, def.version), def)

    return def
  }

  export function project<Def extends Definition>(
    def: Def,
    func: (db: Database.TxOrDb, data: Event<Def>["data"]) => void,
  ): [Definition, ProjectorFunc] {
    return [def, func as ProjectorFunc]
  }

  export interface Interface {
    readonly reset: () => Effect.Effect<void>
    readonly init: (input: {
      projectors: Array<[Definition, ProjectorFunc]>
      convertEvent?: State["convert"]
    }) => Effect.Effect<void>
    readonly replay: (event: SerializedEvent, options?: { republish: boolean }) => Effect.Effect<void>
    readonly run: <Def extends Definition>(def: Def, data: Event<Def>["data"]) => Effect.Effect<void>
    readonly remove: (aggregateID: string) => Effect.Effect<void>
    readonly subscribeAll: (handler: (event: { def: Definition; event: Event }) => void) => Effect.Effect<() => void>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/SyncEvent") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const state: State = {
        projectors: undefined,
        convert: noop,
        bus: new EventEmitter<{ event: [{ def: Definition; event: Event }] }>(),
      }

      function process<Def extends Definition>(def: Def, event: Event<Def>, options: { publish: boolean }) {
        if (state.projectors == null) {
          throw new Error("No projectors available. Call `SyncEvent.init` to install projectors")
        }

        const projector = state.projectors.get(def)
        if (!projector) {
          throw new Error(`Projector not found for event: ${def.type}`)
        }

        Database.transaction((tx) => {
          projector(tx, event.data)

          if (Flag.OPENCODE_EXPERIMENTAL_WORKSPACES) {
            tx.insert(EventSequenceTable)
              .values({
                aggregate_id: event.aggregateID,
                seq: event.seq,
              })
              .onConflictDoUpdate({
                target: EventSequenceTable.aggregate_id,
                set: { seq: event.seq },
              })
              .run()
            tx.insert(EventTable)
              .values({
                id: event.id,
                seq: event.seq,
                aggregate_id: event.aggregateID,
                type: versionedType(def.type, def.version),
                data: event.data as Record<string, unknown>,
              })
              .run()
          }

          Database.effect(() => {
            state.bus.emit("event", { def, event })

            if (!options.publish) return

            const result = state.convert(def.type, event.data)
            if (result instanceof Promise) {
              result.then((data) => {
                ProjectBus.publish({ type: def.type, properties: def.schema }, data)
              })
              return
            }

            ProjectBus.publish({ type: def.type, properties: def.schema }, result)
          })
        })
      }

      const reset = Effect.fn("SyncEvent.reset")(() =>
        Effect.sync(() => {
          frozen = false
          state.projectors = undefined
          state.convert = noop
        }),
      )

      const init = Effect.fn("SyncEvent.init")(
        (input: { projectors: Array<[Definition, ProjectorFunc]>; convertEvent?: State["convert"] }) =>
          Effect.sync(() => {
            state.projectors = new Map(input.projectors)

            for (const [type, version] of versions.entries()) {
              const def = registry.get(versionedType(type, version))!
              BusEvent.define(def.type, def.properties)
            }

            frozen = true
            state.convert = input.convertEvent || noop
          }),
      )

      // TODO:
      //
      // * Support applying multiple events at one time. One transaction,
      //   and it validets all the sequence ids
      // * when loading events from db, apply zod validation to ensure shape

      const replay = Effect.fn("SyncEvent.replay")(function* (
        event: SerializedEvent,
        options?: { republish: boolean },
      ) {
        const def = registry.get(event.type)
        if (!def) {
          throw new Error(`Unknown event type: ${event.type}`)
        }

        const row = Database.use((db) =>
          db
            .select({ seq: EventSequenceTable.seq })
            .from(EventSequenceTable)
            .where(eq(EventSequenceTable.aggregate_id, event.aggregateID))
            .get(),
        )

        const latest = row?.seq ?? -1
        if (event.seq <= latest) {
          return
        }

        const expected = latest + 1
        if (event.seq !== expected) {
          throw new Error(
            `Sequence mismatch for aggregate "${event.aggregateID}": expected ${expected}, got ${event.seq}`,
          )
        }

        yield* Effect.sync(() => process(def, event, { publish: !!options?.republish }))
      })

      const run: Interface["run"] = Effect.fn("SyncEvent.run")(function* <Def extends Definition>(
        def: Def,
        data: Event<Def>["data"],
      ) {
        const agg = (data as Record<string, string>)[def.aggregate]
        if (agg == null) {
          throw new Error(`SyncEvent.run: "${def.aggregate}" required but not found: ${JSON.stringify(data)}`)
        }

        if (def.version !== versions.get(def.type)) {
          throw new Error(`SyncEvent.run: running old versions of events is not allowed: ${def.type}`)
        }

        yield* Effect.sync(() =>
          Database.transaction(
            (tx) => {
              const id = EventID.ascending()
              const row = tx
                .select({ seq: EventSequenceTable.seq })
                .from(EventSequenceTable)
                .where(eq(EventSequenceTable.aggregate_id, agg))
                .get()
              const seq = row?.seq != null ? row.seq + 1 : 0

              const event = { id, seq, aggregateID: agg, data }
              process(def, event, { publish: true })
            },
            {
              behavior: "immediate",
            },
          ),
        )
      })

      const remove = Effect.fn("SyncEvent.remove")((aggregateID: string) =>
        Effect.sync(() => {
          Database.transaction((tx) => {
            tx.delete(EventSequenceTable).where(eq(EventSequenceTable.aggregate_id, aggregateID)).run()
            tx.delete(EventTable).where(eq(EventTable.aggregate_id, aggregateID)).run()
          })
        }),
      )

      const subscribeAll = Effect.fn("SyncEvent.subscribeAll")(
        (handler: (event: { def: Definition; event: Event }) => void) =>
          Effect.sync(() => {
            state.bus.on("event", handler)
            return () => state.bus.off("event", handler)
          }),
      )

      return Service.of({ reset, init, replay, run, remove, subscribeAll })
    }),
  )

  export const defaultLayer = layer

  const { runSync } = makeRuntime(Service, defaultLayer)

  export function reset() {
    return runSync((svc) => svc.reset())
  }

  export function init(input: { projectors: Array<[Definition, ProjectorFunc]>; convertEvent?: State["convert"] }) {
    return runSync((svc) => svc.init(input))
  }

  export function replay(event: SerializedEvent, options?: { republish: boolean }) {
    return runSync((svc) => svc.replay(event, options))
  }

  export function run<Def extends Definition>(def: Def, data: Event<Def>["data"]) {
    return runSync((svc) => svc.run(def, data))
  }

  export function remove(aggregateID: string) {
    return runSync((svc) => svc.remove(aggregateID))
  }

  export function subscribeAll(handler: (event: { def: Definition; event: Event }) => void) {
    return runSync((svc) => svc.subscribeAll(handler))
  }

  export function payloads() {
    return z
      .union(
        registry
          .entries()
          .map(([type, def]) => {
            return z
              .object({
                type: z.literal(type),
                aggregate: z.literal(def.aggregate),
                data: def.schema,
              })
              .meta({
                ref: "SyncEvent" + "." + def.type,
              })
          })
          .toArray() as any,
      )
      .meta({
        ref: "SyncEvent",
      })
  }
}
