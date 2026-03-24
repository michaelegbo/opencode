import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2FunctionTool,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider"

/**
 * Mock Model RPC Protocol
 *
 * The user message text is a JSON object that scripts exactly what the mock
 * model should emit. This lets test harnesses drive the model deterministically.
 *
 * Schema:
 * ```
 * {
 *   "steps": [
 *     // Step 0: executed on first call (no tool results yet)
 *     [
 *       { "type": "tool_call", "name": "write", "input": { "filePath": "a.txt", "content": "hi" } }
 *     ],
 *     // Step 1: executed after first tool-result round
 *     [
 *       { "type": "text", "content": "Done!" }
 *     ]
 *   ]
 * }
 * ```
 *
 * Supported actions:
 *
 *   { "type": "text", "content": "string" }
 *     Emit a text block.
 *
 *   { "type": "tool_call", "name": "toolName", "input": { ... } }
 *     Call a tool. The input object is passed as-is.
 *
 *   { "type": "thinking", "content": "string" }
 *     Emit a reasoning/thinking block.
 *
 *   { "type": "list_tools" }
 *     Respond with a JSON text block listing all available tools and their
 *     schemas. Useful for test scripts that need to discover tool names.
 *
 *   { "type": "error", "message": "string" }
 *     Emit an error chunk.
 *
 * Finish reason is auto-inferred: "tool-calls" when any tool_call action
 * exists in the step, "stop" otherwise. Override with a top-level "finish"
 * field on the script object.
 *
 * If the user message is not valid JSON or doesn't match the schema, the
 * model falls back to a default text response (backward compatible).
 */

// ── Protocol types ──────────────────────────────────────────────────────

type TextAction = { type: "text"; content: string }
type ToolCallAction = { type: "tool_call"; name: string; input: Record<string, unknown> }
type ThinkingAction = { type: "thinking"; content: string }
type ListToolsAction = { type: "list_tools" }
type ErrorAction = { type: "error"; message: string }

type Action = TextAction | ToolCallAction | ThinkingAction | ListToolsAction | ErrorAction

type Script = {
  steps: Action[][]
}

// ── Helpers ─────────────────────────────────────────────────────────────

function text(options: LanguageModelV2CallOptions): string {
  for (const msg of [...options.prompt].reverse()) {
    if (msg.role !== "user") continue
    for (const part of msg.content) {
      if (part.type === "text") return part.text
    }
  }
  return ""
}

/** Count tool-result rounds since the last user message. */
function round(options: LanguageModelV2CallOptions): number {
  let count = 0
  for (const msg of [...options.prompt].reverse()) {
    if (msg.role === "user") break
    if (msg.role === "tool") count++
  }
  return count
}

function parse(raw: string): Script | undefined {
  try {
    const json = JSON.parse(raw)
    if (!json || !Array.isArray(json.steps)) return undefined
    return json as Script
  } catch {
    return undefined
  }
}

function tools(options: LanguageModelV2CallOptions): LanguageModelV2FunctionTool[] {
  if (!options.tools) return []
  return options.tools.filter((t): t is LanguageModelV2FunctionTool => t.type === "function")
}

function emit(actions: Action[], options: LanguageModelV2CallOptions): LanguageModelV2StreamPart[] {
  const chunks: LanguageModelV2StreamPart[] = []
  let tid = 0
  let rid = 0
  let xid = 0

  for (const action of actions) {
    switch (action.type) {
      case "text": {
        const id = `mock-text-${xid++}`
        chunks.push(
          { type: "text-start", id },
          { type: "text-delta", id, delta: action.content },
          { type: "text-end", id },
        )
        break
      }

      case "tool_call": {
        const id = `mock-call-${tid++}`
        const input = JSON.stringify(action.input)
        chunks.push(
          { type: "tool-input-start", id, toolName: action.name },
          { type: "tool-input-delta", id, delta: input },
          { type: "tool-input-end", id },
          { type: "tool-call" as const, toolCallId: id, toolName: action.name, input },
        )
        break
      }

      case "thinking": {
        const id = `mock-reasoning-${rid++}`
        chunks.push(
          { type: "reasoning-start", id },
          { type: "reasoning-delta", id, delta: action.content },
          { type: "reasoning-end", id },
        )
        break
      }

      case "list_tools": {
        const id = `mock-text-${xid++}`
        const defs = tools(options).map((t) => ({
          name: t.name,
          description: t.description,
          input: t.inputSchema,
        }))
        chunks.push(
          { type: "text-start", id },
          { type: "text-delta", id, delta: JSON.stringify(defs, null, 2) },
          { type: "text-end", id },
        )
        break
      }

      case "error": {
        chunks.push({ type: "error", error: new Error(action.message) })
        break
      }
    }
  }

  return chunks
}

// ── Model ───────────────────────────────────────────────────────────────

export class MockLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const
  readonly provider: string
  readonly modelId: string
  readonly supportedUrls: Record<string, RegExp[]> = {}

  constructor(
    id: string,
    readonly options: { provider: string },
  ) {
    this.modelId = id
    this.provider = options.provider
  }

  async doGenerate(options: LanguageModelV2CallOptions): Promise<never> {
    throw new Error("`doGenerate` not implemented")
  }

  async doStream(options: LanguageModelV2CallOptions) {
    const raw = text(options)
    const script = parse(raw)
    const r = round(options)
    const actions = script ? (script.steps[r] ?? []) : undefined

    const chunks: LanguageModelV2StreamPart[] = [
      { type: "stream-start", warnings: [] },
      {
        type: "response-metadata",
        id: "mock-response",
        modelId: this.modelId,
        timestamp: new Date(),
      },
    ]

    if (actions) {
      chunks.push(...emit(actions, options))
    } else {
      // Fallback: plain text response (backward compatible)
      chunks.push(
        { type: "text-start", id: "mock-text-0" },
        {
          type: "text-delta",
          id: "mock-text-0",
          delta: `[mock] This is a streamed mock response from model "${this.modelId}". `,
        },
        {
          type: "text-delta",
          id: "mock-text-0",
          delta: "The mock provider does not call any real API.",
        },
        { type: "text-end", id: "mock-text-0" },
      )
    }

    const called = actions?.some((a) => a.type === "tool_call")
    chunks.push({
      type: "finish",
      finishReason: called ? "tool-calls" : "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    })

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })

    return { stream }
  }
}
