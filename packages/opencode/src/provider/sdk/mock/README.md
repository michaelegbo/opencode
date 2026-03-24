# Mock RPC

Deterministic model scripting for tests.

---

## Overview

The mock provider lets test harnesses script exactly what the model should emit. Instead of hitting a real API, the user message contains a JSON object that describes each step of the conversation. This makes test scenarios fully deterministic and reproducible.

---

## Understand the protocol

The user message text is a JSON object with a `steps` array. Each step is an array of actions that the model emits on that turn.

```json
{
  "steps": [
    [{ "type": "text", "content": "Hello" }],
    [{ "type": "text", "content": "Goodbye" }]
  ]
}
```

The mock model reads the **last** user message in the prompt to find this JSON.

---

## Know how steps are selected

The model picks which step to execute by counting messages with `role: "tool"` in the prompt. This count represents how many tool-result rounds have occurred.

- **Step 0** runs on the first call (no tool results yet).
- **Step 1** runs after the first tool-result round.
- **Step N** runs after the Nth tool-result round.

If the step index is out of bounds, the model emits an empty set of actions.

---

## Use the `text` action

Emits a text block.

```json
{ "type": "text", "content": "Some response text" }
```

| Field     | Type   | Description          |
|-----------|--------|----------------------|
| `content` | string | The text to emit.    |

---

## Use the `tool_call` action

Calls a tool. The input object is passed as-is.

```json
{ "type": "tool_call", "name": "write", "input": { "filePath": "a.txt", "content": "hi" } }
```

| Field   | Type   | Description                     |
|---------|--------|---------------------------------|
| `name`  | string | Name of the tool to call.       |
| `input` | object | Arguments passed to the tool.   |

---

## Use the `thinking` action

Emits a reasoning/thinking block.

```json
{ "type": "thinking", "content": "Let me consider the options..." }
```

| Field     | Type   | Description                |
|-----------|--------|----------------------------|
| `content` | string | The thinking text to emit. |

---

## Use the `list_tools` action

Responds with a JSON text block listing all available tools and their schemas. Useful for test scripts that need to discover tool names. No additional fields.

```json
{ "type": "list_tools" }
```

---

## Use the `error` action

Emits an error chunk.

```json
{ "type": "error", "message": "something went wrong" }
```

| Field     | Type   | Description            |
|-----------|--------|------------------------|
| `message` | string | The error message.     |

---

## Know the finish reason

The finish reason is auto-inferred from the actions in the current step. If any action has `type: "tool_call"`, the finish reason is `"tool-calls"`. Otherwise it is `"stop"`.

Token usage is always reported as `{ inputTokens: 10, outputTokens: 20, totalTokens: 30 }`.

---

## Handle invalid JSON

If the user message is not valid JSON or doesn't have a `steps` array, the model falls back to a default text response. This keeps backward compatibility with tests that don't use the RPC protocol.

---

## Examples

### Simple text response

```json
{
  "steps": [
    [{ "type": "text", "content": "Hello from the mock model" }]
  ]
}
```

### Tool discovery

```json
{
  "steps": [
    [{ "type": "list_tools" }]
  ]
}
```

### Single tool call

```json
{
  "steps": [
    [{ "type": "tool_call", "name": "read", "input": { "filePath": "config.json" } }]
  ]
}
```

### Multi-turn tool use

Step 0 calls a tool. Step 1 runs after the tool result comes back and emits a text response.

```json
{
  "steps": [
    [{ "type": "tool_call", "name": "write", "input": { "filePath": "a.txt", "content": "hi" } }],
    [{ "type": "text", "content": "Done writing the file." }]
  ]
}
```

### Thinking and text

```json
{
  "steps": [
    [
      { "type": "thinking", "content": "The user wants a greeting." },
      { "type": "text", "content": "Hey there!" }
    ]
  ]
}
```

### Multiple actions in one step

A single step can contain any combination of actions.

```json
{
  "steps": [
    [
      { "type": "text", "content": "I'll create two files." },
      { "type": "tool_call", "name": "write", "input": { "filePath": "a.txt", "content": "aaa" } },
      { "type": "tool_call", "name": "write", "input": { "filePath": "b.txt", "content": "bbb" } }
    ],
    [
      { "type": "text", "content": "Both files created." }
    ]
  ]
}
```

### Error simulation

```json
{
  "steps": [
    [{ "type": "error", "message": "rate limit exceeded" }]
  ]
}
```
