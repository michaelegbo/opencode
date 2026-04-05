// Session message extraction and prompt history.
//
// Fetches session messages from the SDK and extracts user turn text for
// the prompt history ring. Also finds the most recently used variant for
// the current model so the footer can pre-select it.
import type { RunInput } from "./types"

const LIMIT = 200

export type SessionMessages = NonNullable<Awaited<ReturnType<RunInput["sdk"]["session"]["messages"]>>["data"]>

type Turn = {
  text: string
  provider: string | undefined
  model: string | undefined
  variant: string | undefined
}

export type RunSession = {
  first: boolean
  turns: Turn[]
}

function text(msg: SessionMessages[number]): string {
  return msg.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text.trim())
    .filter((part) => part.length > 0)
    .join("\n")
}

function turn(msg: SessionMessages[number]): Turn | undefined {
  if (msg.info.role !== "user") {
    return
  }

  return {
    text: text(msg),
    provider: msg.info.model.providerID,
    model: msg.info.model.modelID,
    variant: msg.info.variant,
  }
}

export function createSession(messages: SessionMessages): RunSession {
  return {
    first: messages.length === 0,
    turns: messages.flatMap((msg) => {
      const item = turn(msg)
      return item ? [item] : []
    }),
  }
}

export async function resolveSession(sdk: RunInput["sdk"], sessionID: string, limit = LIMIT): Promise<RunSession> {
  const response = await sdk.session.messages({
    sessionID,
    limit,
  })
  return createSession(response.data ?? [])
}

export function sessionHistory(session: RunSession, limit = LIMIT): string[] {
  const out: string[] = []

  for (const turn of session.turns) {
    if (!turn.text) {
      continue
    }

    if (out[out.length - 1] === turn.text) {
      continue
    }

    out.push(turn.text)
  }

  return out.slice(-limit)
}

export function sessionVariant(session: RunSession, model: RunInput["model"]): string | undefined {
  if (!model) {
    return
  }

  for (let idx = session.turns.length - 1; idx >= 0; idx -= 1) {
    const turn = session.turns[idx]
    if (turn.provider !== model.providerID || turn.model !== model.modelID) {
      continue
    }

    return turn.variant
  }
}
