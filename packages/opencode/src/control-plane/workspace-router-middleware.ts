import { Hono, type MiddlewareHandler } from "hono"
import { Flag } from "../flag/flag"
import { Session } from "../session"
import { getAdaptor } from "./adaptors"
import { Workspace } from "./workspace"

// These are routes that we forward to a workspace, expressed this way
// because we auto-infer the workspace differently for different
// routes
const Router = new Hono()
  .all("/session", async (c) => {
    if (c.req.method === "GET") return c.notFound()

    const body = await c.req.json().catch(() => undefined)
    if (!body || typeof body.workspaceID !== "string") {
      return c.notFound()
    }
    return c.text(body.workspaceID)
  })
  .all("/session/status", async (c) => {
    return c.notFound()
  })
  .all("/session/:sessionID/*", async (c) => {
    if (c.req.method === "GET") return c.notFound()

    const info = await Session.get(c.req.param("sessionID")).catch(() => undefined)
    if (!info?.workspaceID) return c.notFound()
    return c.text(info.workspaceID)
  })

async function routeRequest(req: Request) {
  let workspaceID: string | null = null

  const match = await Router.fetch(req.clone())
  if (match.ok) {
    workspaceID = await match.text()
  } else {
    // Fallback to a header to force routing
    //
    // This header is temporary: we allow the client to force a request
    // to be forwarded to a workspace with it, regardless of the URL.
    // This is only needed because we don't sync yet; when we do we can
    // handle a lot more requests locally and the client won't have to
    // force this
    workspaceID = req.headers.get("x-opencode-workspace")
  }

  if (workspaceID == null) {
    return
  }

  const workspace = await Workspace.get(workspaceID)
  if (!workspace) {
    return new Response(`Workspace not found: ${workspaceID}`, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  }

  const adaptor = await getAdaptor(workspace.type)
  const url = new URL(req.url)

  return adaptor.fetch(workspace, `${url.pathname}${url.search}`, {
    method: req.method,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    signal: req.signal,
    headers: req.headers,
  })
}

export const WorkspaceRouterMiddleware: MiddlewareHandler = async (c, next) => {
  if (!Flag.OPENCODE_EXPERIMENTAL_WORKSPACES) {
    return next()
  }

  const response = await routeRequest(c.req.raw)
  if (response) {
    return response
  }
  return next()
}
