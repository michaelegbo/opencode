import type { AssistantMessage, Message as MessageType } from "@opencode-ai/sdk/v2"
import type { SessionStatus } from "@opencode-ai/sdk/v2/client"

export const pending = (messages: readonly MessageType[]) => {
  const item = messages.findLast((item): item is AssistantMessage => item.role === "assistant")
  if (!item || typeof item.time.completed === "number") return
  return item
}

export const working = (status: SessionStatus | undefined) => status !== undefined && status.type !== "idle"
