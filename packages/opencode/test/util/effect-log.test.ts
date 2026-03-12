import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { Cause, Effect } from "effect"
import { CurrentLogAnnotations, CurrentLogSpans } from "effect/References"

import * as EffectLog from "../../src/util/effect-log"
import { Log } from "../../src/util/log"

const debug = mock(() => {})
const info = mock(() => {})
const warn = mock(() => {})
const error = mock(() => {})

const logger = {
  debug,
  info,
  warn,
  error,
  tag() {
    return logger
  },
  clone() {
    return logger
  },
  time() {
    return {
      stop() {},
      [Symbol.dispose]() {},
    }
  },
}

afterEach(() => {
  debug.mockClear()
  info.mockClear()
  warn.mockClear()
  error.mockClear()
})

test("EffectLog.layer routes info logs through util/log", async () => {
  using create = spyOn(Log, "create").mockReturnValue(logger)

  await Effect.runPromise(Effect.logInfo("hello").pipe(Effect.provide(EffectLog.layer({ service: "effect-test" }))))

  expect(create).toHaveBeenCalledWith({ service: "effect-test" })
  expect(info).toHaveBeenCalledWith("hello", expect.any(Object))
})

test("EffectLog.layer forwards annotations and spans to util/log", async () => {
  using create = spyOn(Log, "create").mockReturnValue(logger)

  await Effect.runPromise(
    Effect.logInfo("hello").pipe(
      Effect.annotateLogs({ requestId: "req-123" }),
      Effect.withLogSpan("provider-auth"),
      Effect.provide(EffectLog.layer({ service: "effect-test-meta" })),
    ),
  )

  expect(create).toHaveBeenCalledWith({ service: "effect-test-meta" })
  expect(info).toHaveBeenCalledWith(
    "hello",
    expect.objectContaining({
      requestId: "req-123",
      spans: expect.arrayContaining([
        expect.objectContaining({
          label: "provider-auth",
        }),
      ]),
    }),
  )
})

test("EffectLog.make formats structured messages and causes for legacy logger", () => {
  using create = spyOn(Log, "create").mockReturnValue(logger)
  const effect = EffectLog.make({ service: "effect-test-struct" })

  effect.log({
    message: { hello: "world" },
    logLevel: "Warn",
    cause: Cause.fail(new Error("boom")),
    fiber: {
      id: 123n,
      getRef(ref: unknown) {
        if (ref === CurrentLogAnnotations) return {}
        if (ref === CurrentLogSpans) return []
        return undefined
      },
    },
    date: new Date(),
  } as never)

  expect(create).toHaveBeenCalledWith({ service: "effect-test-struct" })
  expect(warn).toHaveBeenCalledWith(
    '{"hello":"world"}',
    expect.objectContaining({
      fiber: 123n,
    }),
  )
})
