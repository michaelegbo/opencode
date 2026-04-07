import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { Agent } from "../../src/agent/agent"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { ModelID, ProviderID } from "../../src/provider/schema"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionPrompt } from "../../src/session/prompt"
import { MessageID, SessionID } from "../../src/session/schema"
import { Session } from "../../src/session"
import { TaskTool } from "../../src/tool/task"
import { tmpdir } from "../fixture/fixture"

afterEach(async () => {
  mock.restore()
  await Instance.disposeAll()
})

function wait<T>() {
  let done!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolve) => {
    done = resolve
  })
  return { promise, done }
}

describe("tool.task", () => {
  test("description sorts subagents by name and is stable across calls", async () => {
    await using tmp = await tmpdir({
      config: {
        agent: {
          zebra: {
            description: "Zebra agent",
            mode: "subagent",
          },
          alpha: {
            description: "Alpha agent",
            mode: "subagent",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const build = await Agent.get("build")
        const first = await TaskTool.init({ agent: build })
        const second = await TaskTool.init({ agent: build })

        expect(first.description).toBe(second.description)

        const alpha = first.description.indexOf("- alpha: Alpha agent")
        const explore = first.description.indexOf("- explore:")
        const general = first.description.indexOf("- general:")
        const zebra = first.description.indexOf("- zebra: Zebra agent")

        expect(alpha).toBeGreaterThan(-1)
        expect(explore).toBeGreaterThan(alpha)
        expect(general).toBeGreaterThan(explore)
        expect(zebra).toBeGreaterThan(general)
      },
    })
  })

  test("cancels child session when aborted during creation", async () => {
    const started = wait<void>()
    const gate = wait<void>()
    const parent = SessionID.make("parent")
    const child = SessionID.make("child")
    const messageID = MessageID.ascending()
    const abort = new AbortController()
    const agent: Agent.Info = {
      name: "general",
      description: "General agent",
      mode: "subagent",
      options: {},
      permission: [],
    }
    const ref = {
      providerID: ProviderID.make("test"),
      modelID: ModelID.make("test-model"),
    }

    spyOn(Agent, "list").mockResolvedValue([agent])
    spyOn(Agent, "get").mockResolvedValue(agent)
    spyOn(Config, "get").mockResolvedValue({ experimental: {} } as Awaited<ReturnType<typeof Config.get>>)
    spyOn(MessageV2, "get").mockResolvedValue({
      info: {
        role: "assistant",
        providerID: ref.providerID,
        modelID: ref.modelID,
      },
    } as Awaited<ReturnType<typeof MessageV2.get>>)
    spyOn(Session, "get").mockRejectedValue(new Error("missing"))
    spyOn(Session, "create").mockImplementation(async () => {
      started.done()
      await gate.promise
      return { id: child } as Awaited<ReturnType<typeof Session.create>>
    })
    const cancel = spyOn(SessionPrompt, "cancel").mockResolvedValue()
    spyOn(SessionPrompt, "resolvePromptParts").mockResolvedValue(
      [] as Awaited<ReturnType<typeof SessionPrompt.resolvePromptParts>>,
    )
    spyOn(SessionPrompt, "prompt").mockResolvedValue({
      parts: [{ type: "text", text: "done" }],
    } as Awaited<ReturnType<typeof SessionPrompt.prompt>>)

    const tool = await TaskTool.init()
    const run = tool.execute(
      {
        description: "inspect bug",
        prompt: "check it",
        subagent_type: "general",
      },
      {
        sessionID: parent,
        messageID,
        agent: "build",
        abort: abort.signal,
        messages: [],
        metadata: () => {},
        ask: async () => {},
      },
    )

    await started.promise
    abort.abort()
    gate.done()
    await run

    expect(cancel).toHaveBeenCalledWith(child)
  })
})
