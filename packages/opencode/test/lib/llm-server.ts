import { NodeHttpServer } from "@effect/platform-node"
import * as Http from "node:http"
import { Effect, Layer, ServiceMap, Stream } from "effect"
import * as HttpServer from "effect/unstable/http/HttpServer"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

type Step =
  | {
      type: "text"
      text: string
    }
  | {
      type: "tool"
      tool: string
      input: unknown
    }
  | {
      type: "fail"
      message: string
    }
  | {
      type: "hang"
    }

type Hit = {
  url: URL
  body: Record<string, unknown>
}

function sse(lines: unknown[]) {
  return HttpServerResponse.stream(
    Stream.fromIterable([
      [...lines.map((line) => `data: ${JSON.stringify(line)}`), "data: [DONE]"].join("\n\n") + "\n\n",
    ]).pipe(Stream.encodeText),
    { contentType: "text/event-stream" },
  )
}

function text(step: Extract<Step, { type: "text" }>) {
  return sse([
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ delta: { role: "assistant" } }],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ delta: { content: step.text } }],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ delta: {}, finish_reason: "stop" }],
    },
  ])
}

function tool(step: Extract<Step, { type: "tool" }>, seq: number) {
  const id = `call_${seq}`
  const args = JSON.stringify(step.input)
  return sse([
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ delta: { role: "assistant" } }],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id,
                type: "function",
                function: {
                  name: step.tool,
                  arguments: "",
                },
              },
            ],
          },
        },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: args,
                },
              },
            ],
          },
        },
      ],
    },
    {
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ delta: {}, finish_reason: "tool_calls" }],
    },
  ])
}

function fail(step: Extract<Step, { type: "fail" }>) {
  return HttpServerResponse.text(step.message, { status: 500 })
}

function hang() {
  return HttpServerResponse.stream(
    Stream.fromIterable([
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"delta":{"role":"assistant"}}]}\n\n',
    ]).pipe(Stream.encodeText, Stream.concat(Stream.never)),
    { contentType: "text/event-stream" },
  )
}

namespace TestLLMServer {
  export interface Service {
    readonly url: string
    readonly text: (value: string) => Effect.Effect<void>
    readonly tool: (tool: string, input: unknown) => Effect.Effect<void>
    readonly fail: (message?: string) => Effect.Effect<void>
    readonly hang: Effect.Effect<void>
    readonly hits: Effect.Effect<Hit[]>
    readonly calls: Effect.Effect<number>
    readonly inputs: Effect.Effect<Record<string, unknown>[]>
    readonly pending: Effect.Effect<number>
  }
}

export class TestLLMServer extends ServiceMap.Service<TestLLMServer, TestLLMServer.Service>()("@test/LLMServer") {
  static readonly layer = Layer.effect(
    TestLLMServer,
    Effect.gen(function* () {
      const server = yield* HttpServer.HttpServer
      const router = yield* HttpRouter.HttpRouter

      let hits: Hit[] = []
      let list: Step[] = []
      let seq = 0

      const push = (step: Step) => {
        list = [...list, step]
      }

      const pull = () => {
        const step = list[0]
        if (!step) return { step: undefined, seq }
        seq += 1
        list = list.slice(1)
        return { step, seq }
      }

      yield* router.add(
        "POST",
        "/v1/chat/completions",
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest
          const next = pull()
          if (!next.step) return HttpServerResponse.text("unexpected request", { status: 500 })
          const json = yield* req.json.pipe(Effect.orElseSucceed(() => ({})))
          hits = [
            ...hits,
            {
              url: new URL(req.originalUrl, "http://localhost"),
              body: json && typeof json === "object" ? (json as Record<string, unknown>) : {},
            },
          ]
          if (next.step.type === "text") return text(next.step)
          if (next.step.type === "tool") return tool(next.step, next.seq)
          if (next.step.type === "fail") return fail(next.step)
          return hang()
        }),
      )

      yield* server.serve(router.asHttpEffect())

      return TestLLMServer.of({
        url:
          server.address._tag === "TcpAddress"
            ? `http://127.0.0.1:${server.address.port}/v1`
            : `unix://${server.address.path}/v1`,
        text: Effect.fn("TestLLMServer.text")(function* (value: string) {
          push({ type: "text", text: value })
        }),
        tool: Effect.fn("TestLLMServer.tool")(function* (tool: string, input: unknown) {
          push({ type: "tool", tool, input })
        }),
        fail: Effect.fn("TestLLMServer.fail")(function* (message = "boom") {
          push({ type: "fail", message })
        }),
        hang: Effect.gen(function* () {
          push({ type: "hang" })
        }).pipe(Effect.withSpan("TestLLMServer.hang")),
        hits: Effect.sync(() => [...hits]),
        calls: Effect.sync(() => hits.length),
        inputs: Effect.sync(() => hits.map((hit) => hit.body)),
        pending: Effect.sync(() => list.length),
      })
    }),
  ).pipe(
    Layer.provide(HttpRouter.layer), //
    Layer.provide(NodeHttpServer.layer(() => Http.createServer(), { port: 0 })),
  )
}
