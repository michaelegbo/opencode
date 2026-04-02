import { test as base, expect, type Page } from "@playwright/test"
import { ManagedRuntime } from "effect"
import type { E2EWindow } from "../src/testing/terminal"
import type { Item, Reply, Usage } from "../../opencode/test/lib/llm-server"
import { TestLLMServer } from "../../opencode/test/lib/llm-server"
import { startBackend } from "./backend"
import {
  healthPhase,
  cleanupSession,
  cleanupTestProject,
  createTestProject,
  setHealthPhase,
  seedProjects,
  sessionIDFromUrl,
  waitSession,
  waitSessionIdle,
  waitSessionSaved,
  waitSlug,
} from "./actions"
import { openaiModel, withMockOpenAI } from "./prompt/mock"
import { promptSelector } from "./selectors"
import { createSdk, dirSlug, getWorktree, resolveDirectory, sessionPath } from "./utils"

type LLMFixture = {
  url: string
  push: (...input: (Item | Reply)[]) => Promise<void>
  pushMatch: (
    match: (hit: { url: URL; body: Record<string, unknown> }) => boolean,
    ...input: (Item | Reply)[]
  ) => Promise<void>
  textMatch: (
    match: (hit: { url: URL; body: Record<string, unknown> }) => boolean,
    value: string,
    opts?: { usage?: Usage },
  ) => Promise<void>
  toolMatch: (
    match: (hit: { url: URL; body: Record<string, unknown> }) => boolean,
    name: string,
    input: unknown,
  ) => Promise<void>
  text: (value: string, opts?: { usage?: Usage }) => Promise<void>
  tool: (name: string, input: unknown) => Promise<void>
  toolHang: (name: string, input: unknown) => Promise<void>
  reason: (value: string, opts?: { text?: string; usage?: Usage }) => Promise<void>
  fail: (message?: unknown) => Promise<void>
  error: (status: number, body: unknown) => Promise<void>
  hang: () => Promise<void>
  hold: (value: string, wait: PromiseLike<unknown>) => Promise<void>
  hits: () => Promise<Array<{ url: URL; body: Record<string, unknown> }>>
  calls: () => Promise<number>
  wait: (count: number) => Promise<void>
  inputs: () => Promise<Record<string, unknown>[]>
  pending: () => Promise<number>
  misses: () => Promise<Array<{ url: URL; body: Record<string, unknown> }>>
}

type LLMWorker = LLMFixture & {
  reset: () => Promise<void>
}

type AssistantFixture = {
  reply: (value: string, opts?: { usage?: Usage }) => Promise<void>
  tool: (name: string, input: unknown) => Promise<void>
  toolHang: (name: string, input: unknown) => Promise<void>
  reason: (value: string, opts?: { text?: string; usage?: Usage }) => Promise<void>
  fail: (message?: unknown) => Promise<void>
  error: (status: number, body: unknown) => Promise<void>
  hang: () => Promise<void>
  hold: (value: string, wait: PromiseLike<unknown>) => Promise<void>
  calls: () => Promise<number>
  pending: () => Promise<number>
}

export const settingsKey = "settings.v3"

const seedModel = (() => {
  const [providerID = "opencode", modelID = "big-pickle"] = (
    process.env.OPENCODE_E2E_MODEL ?? "opencode/big-pickle"
  ).split("/")
  return {
    providerID: providerID || "opencode",
    modelID: modelID || "big-pickle",
  }
})()

type ProjectHandle = {
  directory: string
  slug: string
  gotoSession: (sessionID?: string) => Promise<void>
  trackSession: (sessionID: string, directory?: string) => void
  trackDirectory: (directory: string) => void
  sdk: ReturnType<typeof createSdk>
}

type ProjectOptions = {
  extra?: string[]
  model?: { providerID: string; modelID: string }
  setup?: (directory: string) => Promise<void>
  beforeGoto?: (project: { directory: string; sdk: ReturnType<typeof createSdk> }) => Promise<void>
}

type ProjectFixture = ProjectHandle & {
  open: (options?: ProjectOptions) => Promise<void>
  prompt: (text: string) => Promise<string>
}

type TestFixtures = {
  llm: LLMFixture
  assistant: AssistantFixture
  project: ProjectFixture
  sdk: ReturnType<typeof createSdk>
  gotoSession: (sessionID?: string) => Promise<void>
  withProject: <T>(callback: (project: ProjectHandle) => Promise<T>, options?: ProjectOptions) => Promise<T>
  withBackendProject: <T>(callback: (project: ProjectHandle) => Promise<T>, options?: ProjectOptions) => Promise<T>
  withMockProject: <T>(callback: (project: ProjectHandle) => Promise<T>, options?: ProjectOptions) => Promise<T>
}

type WorkerFixtures = {
  _llm: LLMWorker
  backend: {
    url: string
    sdk: (directory?: string) => ReturnType<typeof createSdk>
  }
  directory: string
  slug: string
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  _llm: [
    async ({}, use) => {
      const rt = ManagedRuntime.make(TestLLMServer.layer)
      try {
        const svc = await rt.runPromise(TestLLMServer.asEffect())
        await use({
          url: svc.url,
          push: (...input) => rt.runPromise(svc.push(...input)),
          pushMatch: (match, ...input) => rt.runPromise(svc.pushMatch(match, ...input)),
          textMatch: (match, value, opts) => rt.runPromise(svc.textMatch(match, value, opts)),
          toolMatch: (match, name, input) => rt.runPromise(svc.toolMatch(match, name, input)),
          text: (value, opts) => rt.runPromise(svc.text(value, opts)),
          tool: (name, input) => rt.runPromise(svc.tool(name, input)),
          toolHang: (name, input) => rt.runPromise(svc.toolHang(name, input)),
          reason: (value, opts) => rt.runPromise(svc.reason(value, opts)),
          fail: (message) => rt.runPromise(svc.fail(message)),
          error: (status, body) => rt.runPromise(svc.error(status, body)),
          hang: () => rt.runPromise(svc.hang),
          hold: (value, wait) => rt.runPromise(svc.hold(value, wait)),
          reset: () => rt.runPromise(svc.reset),
          hits: () => rt.runPromise(svc.hits),
          calls: () => rt.runPromise(svc.calls),
          wait: (count) => rt.runPromise(svc.wait(count)),
          inputs: () => rt.runPromise(svc.inputs),
          pending: () => rt.runPromise(svc.pending),
          misses: () => rt.runPromise(svc.misses),
        })
      } finally {
        await rt.dispose()
      }
    },
    { scope: "worker" },
  ],
  backend: [
    async ({ _llm }, use, workerInfo) => {
      const handle = await startBackend(`w${workerInfo.workerIndex}`, { llmUrl: _llm.url })
      try {
        await use({
          url: handle.url,
          sdk: (directory?: string) => createSdk(directory, handle.url),
        })
      } finally {
        await handle.stop()
      }
    },
    { scope: "worker" },
  ],
  llm: async ({ _llm }, use) => {
    await _llm.reset()
    await use({
      url: _llm.url,
      push: _llm.push,
      pushMatch: _llm.pushMatch,
      textMatch: _llm.textMatch,
      toolMatch: _llm.toolMatch,
      text: _llm.text,
      tool: _llm.tool,
      toolHang: _llm.toolHang,
      reason: _llm.reason,
      fail: _llm.fail,
      error: _llm.error,
      hang: _llm.hang,
      hold: _llm.hold,
      hits: _llm.hits,
      calls: _llm.calls,
      wait: _llm.wait,
      inputs: _llm.inputs,
      pending: _llm.pending,
      misses: _llm.misses,
    })
    const pending = await _llm.pending()
    if (pending > 0) {
      throw new Error(`TestLLMServer still has ${pending} queued response(s) after the test finished`)
    }
  },
  assistant: async ({ llm }, use) => {
    await use({
      reply: llm.text,
      tool: llm.tool,
      toolHang: llm.toolHang,
      reason: llm.reason,
      fail: llm.fail,
      error: llm.error,
      hang: llm.hang,
      hold: llm.hold,
      calls: llm.calls,
      pending: llm.pending,
    })
  },
  page: async ({ page }, use) => {
    let boundary: string | undefined
    setHealthPhase(page, "test")
    const consoleHandler = (msg: { text(): string }) => {
      const text = msg.text()
      if (!text.includes("[e2e:error-boundary]")) return
      if (healthPhase(page) === "cleanup") {
        console.warn(`[e2e:error-boundary][cleanup-warning]\n${text}`)
        return
      }
      boundary ||= text
      console.log(text)
    }
    const pageErrorHandler = (err: Error) => {
      console.log(`[e2e:pageerror] ${err.stack || err.message}`)
    }
    page.on("console", consoleHandler)
    page.on("pageerror", pageErrorHandler)
    await use(page)
    page.off("console", consoleHandler)
    page.off("pageerror", pageErrorHandler)
    if (boundary) throw new Error(boundary)
  },
  directory: [
    async ({}, use) => {
      await use(await getWorktree())
    },
    { scope: "worker" },
  ],
  slug: [
    async ({ directory }, use) => {
      await use(dirSlug(directory))
    },
    { scope: "worker" },
  ],
  sdk: async ({ directory }, use) => {
    await use(createSdk(directory))
  },
  gotoSession: async ({ page, directory }, use) => {
    await seedStorage(page, { directory })

    const gotoSession = async (sessionID?: string) => {
      await page.goto(sessionPath(directory, sessionID))
      await waitSession(page, { directory, sessionID })
    }
    await use(gotoSession)
  },
  project: async ({ page, llm, backend }, use) => {
    const item = makeProject(page, llm, backend)
    try {
      await use(item.project)
    } finally {
      await item.cleanup()
    }
  },
  withProject: async ({ page }, use) => {
    await use((callback, options) => runProject(page, callback, options))
  },
  withBackendProject: async ({ page, backend }, use) => {
    await use((callback, options) =>
      runProject(page, callback, { ...options, serverUrl: backend.url, sdk: backend.sdk }),
    )
  },
  withMockProject: async ({ page, llm, backend }, use) => {
    await use((callback, options) =>
      withMockOpenAI({
        serverUrl: backend.url,
        llmUrl: llm.url,
        fn: () =>
          runProject(page, callback, {
            ...options,
            model: options?.model ?? openaiModel,
            serverUrl: backend.url,
            sdk: backend.sdk,
          }),
      }),
    )
  },
})

function makeProject(
  page: Page,
  llm: LLMFixture,
  backend: { url: string; sdk: (directory?: string) => ReturnType<typeof createSdk> },
) {
  let state:
    | {
        directory: string
        slug: string
        sdk: ReturnType<typeof createSdk>
        sessions: Map<string, string>
        dirs: Set<string>
      }
    | undefined

  const need = () => {
    if (state) return state
    throw new Error("project.open() must be called first")
  }

  const trackSession = (sessionID: string, directory?: string) => {
    const cur = need()
    cur.sessions.set(sessionID, directory ?? cur.directory)
  }

  const trackDirectory = (directory: string) => {
    const cur = need()
    if (directory !== cur.directory) cur.dirs.add(directory)
  }

  const gotoSession = async (sessionID?: string) => {
    const cur = need()
    await page.goto(sessionPath(cur.directory, sessionID))
    await waitSession(page, { directory: cur.directory, sessionID, serverUrl: backend.url })
    const current = sessionIDFromUrl(page.url())
    if (current) trackSession(current)
  }

  const open = async (options?: ProjectOptions) => {
    if (state) return
    const directory = await createTestProject({ serverUrl: backend.url })
    const sdk = backend.sdk(directory)
    await options?.setup?.(directory)
    await seedStorage(page, {
      directory,
      extra: options?.extra,
      model: options?.model,
      serverUrl: backend.url,
    })
    state = {
      directory,
      slug: "",
      sdk,
      sessions: new Map(),
      dirs: new Set(),
    }
    await options?.beforeGoto?.({ directory, sdk })
    await gotoSession()
    need().slug = await waitSlug(page)
  }

  const prompt = async (text: string) => {
    const cur = need()
    if ((await llm.pending()) === 0) {
      await llm.text("ok")
    }

    const prompt = page.locator(promptSelector).first()
    await expect(prompt).toBeVisible()
    await prompt.click()
    await prompt.fill(text)
    await prompt.press("Enter")

    await expect(page).toHaveURL(/\/session\/[^/?#]+/, { timeout: 30_000 })
    const sessionID = sessionIDFromUrl(page.url())
    if (!sessionID) throw new Error(`Failed to parse session id from url: ${page.url()}`)

    const current = await page
      .evaluate(() => {
        const win = window as E2EWindow
        const next = win.__opencode_e2e?.model?.current
        if (!next) return null
        return { dir: next.dir, sessionID: next.sessionID }
      })
      .catch(() => null as { dir?: string; sessionID?: string } | null)
    const directory = current?.dir
      ? await resolveDirectory(current.dir, backend.url).catch(() => cur.directory)
      : cur.directory

    trackSession(sessionID, directory)
    await waitSessionSaved(directory, sessionID, 30_000, backend.url)
    await waitSessionIdle(backend.sdk(directory), sessionID, 30_000).catch(() => undefined)
    return sessionID
  }

  const cleanup = async () => {
    const cur = state
    if (!cur) return
    setHealthPhase(page, "cleanup")
    await Promise.allSettled(
      Array.from(cur.sessions, ([sessionID, directory]) =>
        cleanupSession({ sessionID, directory, serverUrl: backend.url }),
      ),
    )
    await Promise.allSettled(Array.from(cur.dirs, (directory) => cleanupTestProject(directory)))
    await cleanupTestProject(cur.directory)
    state = undefined
    setHealthPhase(page, "test")
  }

  return {
    project: {
      open,
      prompt,
      gotoSession,
      trackSession,
      trackDirectory,
      get directory() {
        return need().directory
      },
      get slug() {
        return need().slug
      },
      get sdk() {
        return need().sdk
      },
    },
    cleanup,
  }
}

async function runProject<T>(
  page: Page,
  callback: (project: ProjectHandle) => Promise<T>,
  options?: ProjectOptions & {
    serverUrl?: string
    sdk?: (directory?: string) => ReturnType<typeof createSdk>
  },
) {
  const url = options?.serverUrl
  const root = await createTestProject(url ? { serverUrl: url } : undefined)
  const sdk = options?.sdk?.(root) ?? createSdk(root, url)
  const sessions = new Map<string, string>()
  const dirs = new Set<string>()
  await options?.setup?.(root)
  await seedStorage(page, {
    directory: root,
    extra: options?.extra,
    model: options?.model,
    serverUrl: url,
  })

  const gotoSession = async (sessionID?: string) => {
    await page.goto(sessionPath(root, sessionID))
    await waitSession(page, { directory: root, sessionID, serverUrl: url })
    const current = sessionIDFromUrl(page.url())
    if (current) trackSession(current)
  }

  const trackSession = (sessionID: string, directory?: string) => {
    sessions.set(sessionID, directory ?? root)
  }

  const trackDirectory = (directory: string) => {
    if (directory !== root) dirs.add(directory)
  }

  try {
    await options?.beforeGoto?.({ directory: root, sdk })
    await gotoSession()
    const slug = await waitSlug(page)
    return await callback({ directory: root, slug, gotoSession, trackSession, trackDirectory, sdk })
  } finally {
    setHealthPhase(page, "cleanup")
    await Promise.allSettled(
      Array.from(sessions, ([sessionID, directory]) => cleanupSession({ sessionID, directory, serverUrl: url })),
    )
    await Promise.allSettled(Array.from(dirs, (directory) => cleanupTestProject(directory)))
    await cleanupTestProject(root)
    setHealthPhase(page, "test")
  }
}

async function seedStorage(
  page: Page,
  input: {
    directory: string
    extra?: string[]
    model?: { providerID: string; modelID: string }
    serverUrl?: string
  },
) {
  await seedProjects(page, input)
  await page.addInitScript((model: { providerID: string; modelID: string }) => {
    const win = window as E2EWindow
    win.__opencode_e2e = {
      ...win.__opencode_e2e,
      model: {
        enabled: true,
      },
      prompt: {
        enabled: true,
      },
      terminal: {
        enabled: true,
        terminals: {},
      },
    }
    localStorage.setItem(
      "opencode.global.dat:model",
      JSON.stringify({
        recent: [model],
        user: [],
        variant: {},
      }),
    )
  }, input.model ?? seedModel)
}

export { expect }
