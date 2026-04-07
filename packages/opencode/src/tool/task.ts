import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import z from "zod"
import { Effect } from "effect"
import { Config } from "../config/config"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { MessageV2 } from "../session/message-v2"
import { Agent } from "../agent/agent"
import type { SessionID } from "../session/schema"
import { MessageID, SessionID as SessionRef } from "../session/schema"
import { defer } from "@/util/defer"
import { Permission } from "@/permission"
import { output, run } from "./subtask"

const parameters = z.object({
  description: z.string().describe("A short (3-5 words) description of the task"),
  prompt: z.string().describe("The task for the agent to perform"),
  subagent_type: z.string().describe("The type of specialized agent to use for this task"),
  task_id: z
    .string()
    .describe(
      "This should only be set if you mean to resume a previous task (you can pass a prior task_id and the task will continue the same subagent session as before instead of creating a fresh one)",
    )
    .optional(),
  command: z.string().describe("The command that triggered this task").optional(),
})

export const TaskTool = Tool.define("task", async (ctx) => {
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))

  // Filter agents by permissions if agent provided
  const caller = ctx?.agent
  const accessibleAgents = caller
    ? agents.filter((a) => Permission.evaluate("task", a.name, caller.permission).action !== "deny")
    : agents
  const list = accessibleAgents.toSorted((a, b) => a.name.localeCompare(b.name))

  const description = DESCRIPTION.replace(
    "{agents}",
    list
      .map((a) => `- ${a.name}: ${a.description ?? "This subagent should only be called manually by the user."}`)
      .join("\n"),
  )
  return {
    description,
    parameters,
    async execute(params: z.infer<typeof parameters>, ctx) {
      // Skip permission check when user explicitly invoked via @ or command subtask
      if (!ctx.extra?.bypassAgentCheck) {
        await ctx.ask({
          permission: "task",
          patterns: [params.subagent_type],
          always: ["*"],
          metadata: {
            description: params.description,
            subagent_type: params.subagent_type,
          },
        })
      }

      const agent = await Agent.get(params.subagent_type)
      if (!agent) throw new Error(`Unknown agent type: ${params.subagent_type} is not a valid agent type`)
      const msg = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
      if (msg.info.role !== "assistant") throw new Error("Not an assistant message")

      let child: SessionID | undefined
      const cancel = () => {
        if (!child) return
        SessionPrompt.cancel(child)
      }
      ctx.abort.addEventListener("abort", cancel)
      using _ = defer(() => ctx.abort.removeEventListener("abort", cancel))

      const task = await Effect.runPromise(
        run(
          {
            cfg: Effect.promise(() => Config.get()),
            get: (taskID) => Effect.promise(() => Session.get(SessionRef.make(taskID)).catch(() => undefined)),
            create: (input) => Effect.promise(() => Session.create(input)),
            resolve: (prompt) => Effect.promise(() => SessionPrompt.resolvePromptParts(prompt)),
            prompt: (input) =>
              Effect.promise(() => SessionPrompt.prompt({ ...input, messageID: MessageID.ascending() })),
          },
          {
            parentID: ctx.sessionID,
            taskID: params.task_id,
            description: params.description,
            prompt: params.prompt,
            agent,
            abort: ctx.abort,
            cancel: SessionPrompt.cancel,
            model: {
              modelID: msg.info.modelID,
              providerID: msg.info.providerID,
            },
            start(sessionID, model) {
              child = sessionID
              ctx.metadata({
                title: params.description,
                metadata: {
                  sessionId: sessionID,
                  model,
                },
              })
            },
          },
        ),
      )

      return {
        title: params.description,
        metadata: {
          sessionId: task.sessionID,
          model: task.model,
        },
        output: output(task.sessionID, task.text),
      }
    },
  }
})
