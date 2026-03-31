import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { NodeFileSystem } from "@effect/platform-node"
import * as CrossSpawnSpawner from "../../src/effect/cross-spawn-spawner"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Log } from "../../src/util/log"
import { testEffect } from "../lib/effect"
import { provideTmpdirInstance } from "../fixture/fixture"
import { TestLLMServer } from "../lib/llm-server"
import { Layer } from "effect"

Log.init({ print: false })

const baseLayer = Layer.mergeAll(NodeFileSystem.layer, CrossSpawnSpawner.defaultLayer, TestLLMServer.layer)

const it = testEffect(baseLayer)

function makeConfig(url: string) {
  return {
    provider: {
      test: {
        name: "Test",
        env: [],
        npm: "@ai-sdk/openai-compatible",
        models: {
          "gpt-5-nano": {
            id: "gpt-5-nano",
            name: "Test Model",
            attachment: false,
            reasoning: false,
            temperature: false,
            tool_call: true,
            release_date: "2025-01-01",
            limit: { context: 100000, output: 10000 },
            cost: { input: 0, output: 0 },
            options: {},
          },
        },
        options: {
          apiKey: "test-key",
          baseURL: url,
        },
      },
    },
    agent: {
      build: {
        model: "test/gpt-5-nano",
      },
    },
  }
}

describe("session.prompt provider integration", () => {
  it.effect("loop returns assistant text through local provider", () =>
    Effect.gen(function* () {
      const llm = yield* TestLLMServer
      return yield* provideTmpdirInstance(
        () =>
          Effect.gen(function* () {
            const session = yield* Effect.promise(() =>
              Session.create({
                title: "Prompt provider",
                permission: [{ permission: "*", pattern: "*", action: "allow" }],
              }),
            )

            yield* Effect.promise(() =>
              SessionPrompt.prompt({
                sessionID: session.id,
                agent: "build",
                noReply: true,
                parts: [{ type: "text", text: "hello" }],
              }),
            )

            yield* llm.text("world")

            const result = yield* Effect.promise(() => SessionPrompt.loop({ sessionID: session.id }))
            expect(result.info.role).toBe("assistant")
            expect(result.parts.some((part) => part.type === "text" && part.text === "world")).toBe(true)
            expect(yield* llm.hits).toHaveLength(1)
            expect(yield* llm.pending).toBe(0)
          }),
        { git: true, config: makeConfig(llm.url) },
      )
    }),
  )

  it.effect("loop consumes queued replies across turns", () =>
    Effect.gen(function* () {
      const llm = yield* TestLLMServer
      return yield* provideTmpdirInstance(
        () =>
          Effect.gen(function* () {
            const session = yield* Effect.promise(() =>
              Session.create({
                title: "Prompt provider turns",
                permission: [{ permission: "*", pattern: "*", action: "allow" }],
              }),
            )

            yield* Effect.promise(() =>
              SessionPrompt.prompt({
                sessionID: session.id,
                agent: "build",
                noReply: true,
                parts: [{ type: "text", text: "hello one" }],
              }),
            )

            yield* llm.text("world one")

            const first = yield* Effect.promise(() => SessionPrompt.loop({ sessionID: session.id }))
            expect(first.info.role).toBe("assistant")
            expect(first.parts.some((part) => part.type === "text" && part.text === "world one")).toBe(true)

            yield* Effect.promise(() =>
              SessionPrompt.prompt({
                sessionID: session.id,
                agent: "build",
                noReply: true,
                parts: [{ type: "text", text: "hello two" }],
              }),
            )

            yield* llm.text("world two")

            const second = yield* Effect.promise(() => SessionPrompt.loop({ sessionID: session.id }))
            expect(second.info.role).toBe("assistant")
            expect(second.parts.some((part) => part.type === "text" && part.text === "world two")).toBe(true)

            expect(yield* llm.hits).toHaveLength(2)
            expect(yield* llm.pending).toBe(0)
          }),
        { git: true, config: makeConfig(llm.url) },
      )
    }),
  )
})
