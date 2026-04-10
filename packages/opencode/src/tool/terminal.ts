import z from "zod"
import path from "path"
import DESCRIPTION from "./terminal.txt"
import { Tool } from "./tool"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import { BashArity } from "@/permission/arity"
import { Pty } from "@/pty"
import type { PtyID } from "@/pty/schema"
import { Bus } from "@/bus"

const WAIT = 20_000
const LIMIT = 24_000

const Parameters = z.object({
  command: z.string().describe("Executable to run, for example bun, npm, pnpm, python, or cargo"),
  args: z.array(z.string()).optional().describe("Arguments for the executable"),
  workdir: z
    .string()
    .optional()
    .describe("Working directory for the command. Defaults to the current workspace directory."),
  title: z
    .string()
    .optional()
    .describe("Terminal title shown in the app. Use Preview for frontend dev servers."),
  wait_for_url: z
    .boolean()
    .optional()
    .describe("Wait for a localhost URL to appear in output before returning. Defaults to true."),
  timeout: z
    .number()
    .optional()
    .describe("How long to wait for startup output before returning, in milliseconds. Defaults to 20000."),
})

type Meta = {
  ptyID: string
  title: string
  cwd: string
  command: string
  args: string[]
  output: string
  running: boolean
  url?: string
  exit?: number
}

type Sock = {
  readyState: number
  data: object
  send: (data: string | Uint8Array | ArrayBuffer) => void
  close: () => void
}

const clip = (text: string) => {
  if (text.length <= LIMIT) return text
  return text.slice(0, LIMIT) + "\n\n..."
}

const find = (text: string) => {
  const hit = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[a-z0-9.-]+):\d+(?:\/\S*)?/i)?.[0]
  if (!hit) return
  return hit.replace("0.0.0.0", "localhost").replace("[::1]", "localhost")
}

const line = (command: string, args: string[]) => [command, ...args].join(" ").trim()

const title = (command: string, args: string[], value?: string) => {
  if (value?.trim()) return value.trim()
  return line(command, args).slice(0, 60)
}

const cwd = (dir?: string) => {
  if (!dir) return Instance.directory
  return Filesystem.resolve(path.resolve(Instance.directory, Filesystem.windowsPath(dir)))
}

const summary = (meta: Meta, timeout: number) => {
  const out = [
    `Started ${meta.title || "terminal"} in ${meta.cwd}.`,
    `Command: ${line(meta.command, meta.args)}`,
  ]
  if (meta.url) out.push(`URL: ${meta.url}`)
  if (meta.exit !== undefined) out.push(`Process exited with code ${meta.exit}.`)
  if (!meta.url && meta.running) out.push(`No localhost URL detected within ${timeout}ms.`)
  if (meta.output.trim()) out.push(`Recent output:\n${clip(meta.output.trim())}`)
  return out.join("\n")
}

const ask = async (ctx: Tool.Context, dir: string, command: string, args: string[]) => {
  if (!Instance.containsPath(dir)) {
    const glob = Filesystem.normalizePathPattern(path.join(dir, "*"))
    await ctx.ask({
      permission: "external_directory",
      patterns: [glob],
      always: [glob],
      metadata: {},
    })
  }

  const tokens = [command, ...args]
  await ctx.ask({
    permission: "bash",
    patterns: [line(command, args)],
    always: [`${BashArity.prefix(tokens).join(" ")} *`],
    metadata: {},
  })
}

const watch = async (input: {
  ctx: Tool.Context<Meta>
  id: PtyID
  meta: Omit<Meta, "output" | "running">
  timeout: number
  wait: boolean
}) => {
  let out = ""
  let url = ""
  let exit: number | undefined

  const push = () => {
    input.ctx.metadata({
      title: input.meta.title,
      metadata: {
        ...input.meta,
        output: clip(out),
        running: exit === undefined,
        ...(url ? { url } : {}),
        ...(exit !== undefined ? { exit } : {}),
      },
    })
  }

  push()
  if (!input.wait) {
    return {
      ...input.meta,
      output: "",
      running: true,
    } satisfies Meta
  }

  const done = await new Promise<Meta>((resolve) => {
    let off: VoidFunction = () => {}
    let conn: Awaited<ReturnType<typeof Pty.connect>> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let abort: VoidFunction = () => {}
    let closed = false

    const finish = () => {
      if (closed) return
      closed = true
      if (timer) clearTimeout(timer)
      abort()
      off()
      conn?.onClose()
      resolve({
        ...input.meta,
        output: clip(out),
        running: exit === undefined,
        ...(url ? { url } : {}),
        ...(exit !== undefined ? { exit } : {}),
      })
    }

    const sock: Sock = {
      readyState: 1,
      data: {},
      send(data) {
        if (typeof data !== "string") return
        out += data
        const next = find(data) ?? (!url ? find(out) : undefined)
        if (next && !url) url = next
        push()
        if (url) finish()
      },
      close() {
        sock.readyState = 3
      },
    }

    timer = setTimeout(finish, input.timeout)
    off = Bus.subscribe(Pty.Event.Exited, (event) => {
      if (event.properties.id !== input.id) return
      exit = event.properties.exitCode
      push()
      finish()
    })

    const stop = () => finish()
    if (input.ctx.abort.aborted) stop()
    else {
      input.ctx.abort.addEventListener("abort", stop, { once: true })
      abort = () => input.ctx.abort.removeEventListener("abort", stop)
    }

    void Pty.connect(input.id, sock, 0)
      .then((value) => {
        if (closed) {
          value?.onClose()
          return
        }
        conn = value
      })
      .catch(() => finish())
  })

  return done
}

export const TerminalTool = Tool.define("terminal", {
  description: DESCRIPTION,
  parameters: Parameters,
  async execute(params, ctx) {
    const args = params.args ?? []
    const dir = cwd(params.workdir)
    const name = title(params.command, args, params.title)
    const waitFor = params.wait_for_url ?? true
    const timeout = params.timeout ?? WAIT

    await ask(ctx, dir, params.command, args)

    const info = await Pty.create({
      command: params.command,
      args,
      cwd: dir,
      title: name,
    })

    const meta = await watch({
      ctx,
      id: info.id,
      timeout,
      wait: waitFor,
      meta: {
        ptyID: info.id,
        title: info.title,
        cwd: dir,
        command: params.command,
        args,
      },
    })

    return {
      title: info.title,
      metadata: meta,
      output: summary(meta, timeout),
    }
  },
})
