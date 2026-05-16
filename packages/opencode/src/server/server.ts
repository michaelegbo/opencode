import { Log } from "../util/log"
import { describeRoute, generateSpecs, validator, resolver, openAPIRouteHandler } from "hono-openapi"
import { Hono } from "hono"
import { compress } from "hono/compress"
import { cors } from "hono/cors"
import { basicAuth } from "hono/basic-auth"
import type { UpgradeWebSocket } from "hono/ws"
import z from "zod"
import { Auth } from "../auth"
import { Flag } from "../flag/flag"
import { ProviderID } from "../provider/schema"
import { upgradeWebSocket } from "hono/bun"
import { WorkspaceRouterMiddleware } from "./router"
import { errors } from "./error"
import { GlobalRoutes } from "./routes/global"
import { MDNS } from "./mdns"
import { lazy } from "@/util/lazy"
import { errorHandler } from "./middleware"
import { InstanceRoutes } from "./instance"
import { initProjectors } from "./projectors"

// @ts-ignore This global is needed to prevent ai-sdk from logging warnings to stdout https://github.com/vercel/ai/blob/2dc67e0ef538307f21368db32d5a12345d98831b/packages/ai/src/logger/log-warnings.ts#L85
globalThis.AI_SDK_LOG_WARNINGS = false

initProjectors()

export namespace Server {
  export type Listener = {
    hostname: string
    port: number
    url: URL
    stop: (close?: boolean) => Promise<void>
  }

  const log = Log.create({ service: "server" })
  const zipped = compress()

  const skipCompress = (path: string, method: string) => {
    if (path === "/event" || path === "/global/event" || path === "/global/sync-event") return true
    if (method === "POST" && /\/session\/[^/]+\/(message|prompt_async)$/.test(path)) return true
    return false
  }

  export const Default = lazy(() => create({}).app)

  function verifyWsAuth(req: Request): boolean {
    const password = Flag.OPENCODE_SERVER_PASSWORD
    if (!password) return true
    const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
    const expected = `${username}:${password}`

    // Check Authorization header (Basic auth)
    const authHeader = req.headers.get("authorization")
    if (authHeader) {
      const match = authHeader.match(/^Basic\s+(.+)$/i)
      if (match) {
        try {
          const decoded = atob(match[1])
          if (decoded === expected) return true
        } catch {}
      }
    }

    // Check ?auth= query parameter (base64-encoded credentials)
    const url = new URL(req.url)
    const authParam = url.searchParams.get("auth")
    if (authParam) {
      try {
        const decoded = atob(authParam)
        if (decoded === expected) return true
      } catch {}
    }

    // Check URL credentials (username:password in URL)
    if (url.username && url.password) {
      const urlCreds = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
      if (urlCreds === expected) return true
    }

    return false
  }

  export function ControlPlaneRoutes(upgrade: UpgradeWebSocket, app = new Hono(), opts?: { cors?: string[] }): Hono {
    return app
      .onError(errorHandler(log))
      .use((c, next) => {
        // Allow CORS preflight requests to succeed without auth.
        // Browser clients sending Authorization headers will preflight with OPTIONS.
        if (c.req.method === "OPTIONS") return next()
        const password = Flag.OPENCODE_SERVER_PASSWORD
        if (!password) return next()
        const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
        return basicAuth({ username, password })(c, next)
      })
      .use(async (c, next) => {
        const skip = c.req.path === "/log"
        if (!skip) {
          log.info("request", {
            method: c.req.method,
            path: c.req.path,
          })
        }
        const timer = log.time("request", {
          method: c.req.method,
          path: c.req.path,
        })
        await next()
        if (!skip) timer.stop()
      })
      .use(
        cors({
          maxAge: 86_400,
          origin(input) {
            if (!input) return

            if (input.startsWith("http://localhost:")) return input
            if (input.startsWith("http://127.0.0.1:")) return input
            if (
              input === "tauri://localhost" ||
              input === "http://tauri.localhost" ||
              input === "https://tauri.localhost"
            )
              return input

            if (/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/.test(input)) return input
            if (opts?.cors?.includes(input)) return input
          },
        }),
      )
      .use((c, next) => {
        if (skipCompress(c.req.path, c.req.method)) return next()
        return zipped(c, next)
      })
      .route("/global", GlobalRoutes())
      .put(
        "/auth/:providerID",
        describeRoute({
          summary: "Set auth credentials",
          description: "Set authentication credentials",
          operationId: "auth.set",
          responses: {
            200: {
              description: "Successfully set authentication credentials",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "param",
          z.object({
            providerID: ProviderID.zod,
          }),
        ),
        validator("json", Auth.Info.zod),
        async (c) => {
          const providerID = c.req.valid("param").providerID
          const info = c.req.valid("json")
          await Auth.set(providerID, info)
          return c.json(true)
        },
      )
      .delete(
        "/auth/:providerID",
        describeRoute({
          summary: "Remove auth credentials",
          description: "Remove authentication credentials",
          operationId: "auth.remove",
          responses: {
            200: {
              description: "Successfully removed authentication credentials",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "param",
          z.object({
            providerID: ProviderID.zod,
          }),
        ),
        async (c) => {
          const providerID = c.req.valid("param").providerID
          await Auth.remove(providerID)
          return c.json(true)
        },
      )
      .get(
        "/doc",
        openAPIRouteHandler(app, {
          documentation: {
            info: {
              title: "opencode",
              version: "0.0.3",
              description: "opencode api",
            },
            openapi: "3.1.1",
          },
        }),
      )
      .use(
        validator(
          "query",
          z.object({
            directory: z.string().optional(),
            workspace: z.string().optional(),
          }),
        ),
      )
      .post(
        "/log",
        describeRoute({
          summary: "Write log",
          description: "Write a log entry to the server logs with specified level and metadata.",
          operationId: "app.log",
          responses: {
            200: {
              description: "Log entry written successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.object({
            service: z.string().meta({ description: "Service name for the log entry" }),
            level: z.enum(["debug", "info", "error", "warn"]).meta({ description: "Log level" }),
            message: z.string().meta({ description: "Log message" }),
            extra: z
              .record(z.string(), z.any())
              .optional()
              .meta({ description: "Additional metadata for the log entry" }),
          }),
        ),
        async (c) => {
          const { service, level, message, extra } = c.req.valid("json")
          const logger = Log.create({ service })

          switch (level) {
            case "debug":
              logger.debug(message, extra)
              break
            case "info":
              logger.info(message, extra)
              break
            case "error":
              logger.error(message, extra)
              break
            case "warn":
              logger.warn(message, extra)
              break
          }

          return c.json(true)
        },
      )
      .use(WorkspaceRouterMiddleware(upgrade))
  }

  function create(opts: { cors?: string[] }) {
    const app = new Hono()
    return {
      app: ControlPlaneRoutes(upgradeWebSocket, app, opts),
    }
  }

  export function createApp(opts: { cors?: string[] }) {
    return create(opts).app
  }

  export async function openapi() {
    // Build a fresh app with all routes registered directly so
    // hono-openapi can see describeRoute metadata (`.route()` wraps
    // handlers when the sub-app has a custom errorHandler, which
    // strips the metadata symbol).
    const { app } = create({})
    InstanceRoutes(upgradeWebSocket, app)
    const result = await generateSpecs(app, {
      documentation: {
        info: {
          title: "opencode",
          version: "1.0.0",
          description: "opencode api",
        },
        openapi: "3.1.1",
      },
    })
    return result
  }

  export let url: URL

  export async function listen(opts: {
    port: number
    hostname: string
    mdns?: boolean
    mdnsDomain?: string
    cors?: string[]
  }): Promise<Listener> {
    const built = create(opts)

    // PTY WebSocket connection handler — uses dynamic imports to avoid
    // circular dependencies in the compiled binary.
    async function handlePtyWebSocket(
      ws: { data: any; close: (code?: number, reason?: string) => void; readyState: number; send: (data: string | Uint8Array | ArrayBuffer) => void },
      ptyID: string,
      directory: string,
      cursorParam: string | null,
    ) {
      try {
        const { Instance } = await import("../project/instance")
        const { InstanceBootstrap } = await import("../project/bootstrap")
        const { Pty } = await import("../pty")
        const { PtyID } = await import("../pty/schema")
        const { Filesystem } = await import("../util/filesystem")

        const id = PtyID.zod.parse(ptyID)
        const dir = Filesystem.resolve(
          (() => {
            try {
              return decodeURIComponent(directory)
            } catch {
              return directory
            }
          })(),
        )
        const cursor = (() => {
          if (cursorParam == null) return undefined
          const parsed = Number(cursorParam)
          if (!Number.isSafeInteger(parsed) || parsed < -1) return undefined
          return parsed
        })()

        await Instance.provide({
          directory: dir,
          init: InstanceBootstrap,
          async fn() {
            const session = await Pty.get(id)
            if (!session) {
              ws.close(1011, "Session not found")
              return
            }
            const handler = await Pty.connect(id, ws, cursor)
            if (handler) {
              ws.data.handler = handler
            }
          },
        })
      } catch (err) {
        log.error("PTY WebSocket open failed", { error: String(err) })
        try {
          ws.close(1011, "Internal error")
        } catch {}
      }
    }

    const start = (port: number) => {
      const server = Bun.serve({
        port,
        hostname: opts.hostname,
        fetch(req, server) {
          // WebSocket upgrades must happen at the top level of Bun.serve's
          // fetch handler — NOT inside Hono's async middleware chain.
          // See: https://github.com/honojs/hono/issues/2696
          if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
            if (!verifyWsAuth(req)) {
              return new Response("Unauthorized", { status: 401 })
            }
            const reqUrl = new URL(req.url)
            const success = server.upgrade(req, {
              data: {
                url: reqUrl.toString(),
                pathname: reqUrl.pathname,
                directory: reqUrl.searchParams.get("directory") || process.cwd(),
                cursor: reqUrl.searchParams.get("cursor"),
                handler: null as any,
              },
            })
            if (success) return undefined as unknown as Response
            return new Response("WebSocket upgrade failed", { status: 500 })
          }
          return built.app.fetch(req, server)
        },
        websocket: {
          async open(ws) {
            const { pathname, directory, cursor } = ws.data

            // Match PTY connect route: /pty/:ptyID/connect
            const ptyMatch = pathname.match(/^\/pty\/([^/]+)\/connect$/)
            if (ptyMatch) {
              await handlePtyWebSocket(ws, ptyMatch[1], directory, cursor)
              return
            }

            // Unknown WebSocket route — close
            ws.close(1011, "Unknown WebSocket route")
          },
          message(ws, message) {
            ws.data.handler?.onMessage(typeof message === "string" ? message : String(message))
          },
          close(ws) {
            ws.data.handler?.onClose()
          },
        },
      })
      return server
    }

    let server: ReturnType<typeof Bun.serve>
    try {
      server = opts.port === 0 ? start(4096) : start(opts.port)
    } catch {
      server = opts.port === 0 ? start(0) : start(opts.port)
    }

    const next = new URL("http://localhost")
    next.hostname = opts.hostname
    next.port = String(server.port)
    url = next

    const mdns =
      opts.mdns &&
      server.port &&
      opts.hostname !== "127.0.0.1" &&
      opts.hostname !== "localhost" &&
      opts.hostname !== "::1"
    if (mdns) {
      MDNS.publish(server.port, opts.mdnsDomain)
    } else if (opts.mdns) {
      log.warn("mDNS enabled but hostname is loopback; skipping mDNS publish")
    }

    let closing: Promise<void> | undefined
    return {
      hostname: opts.hostname,
      port: server.port,
      url: next,
      stop(_close?: boolean) {
        closing ??= new Promise<void>((resolve) => {
          if (mdns) MDNS.unpublish()
          server.stop(true)
          resolve()
        })
        return closing
      },
    }
  }
}
