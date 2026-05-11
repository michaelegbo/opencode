import { Button } from "@opencode-ai/ui/button"
import { createEffect, createMemo, createResource, createSignal, onCleanup, onMount, Show } from "solid-js"
import { type AuthUser, useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { PADDIE_APP_ORIGIN, WORKFLOW_BUILDER_URL } from "@/lib/paddie-links"

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const esc = (value: string) => value.replace(/<\/(script|style)/gi, "<\\/$1")
const full =
  /([A-Za-z_$][\w$]*)\.jsx\(([A-Za-z_$][\w$]*),\{path:"\/studio\/fullscreen",element:\1\.jsx\(([A-Za-z_$][\w$]*),\{children:\1\.jsx\(([A-Za-z_$][\w$]*),\{autoFullscreen:!0\}\)\}\)\}\)/
const api = /([A-Za-z_$][\w$]*)="\/api",([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\.create\(\{baseURL:\1/

function origin(value: string) {
  return value.replace(
    api,
    (match, base, client, axios) =>
      `${base}=${JSON.stringify(`${PADDIE_APP_ORIGIN}/api`)},${client}=${axios}.create({baseURL:${base}`,
  )
}

function host(value: string) {
  return value.split("window.location.origin").join("(window.__paddie_app_origin||window.location.origin)")
}

function route(value: string) {
  return value.replace(
    full,
    (match, jsx, tag, gate, studio) =>
      `${match},${jsx}.jsx(${tag},{path:"*",element:${jsx}.jsx(${gate},{children:${jsx}.jsx(${studio},{})})})`,
  )
}

function router(value: string) {
  return value.replace(
    /return ([A-Za-z_$][\w$]*)\.jsx\(([A-Za-z_$][\w$]*),\{children:\1\.jsx\(([A-Za-z_$][\w$]*),\{defaultTheme:"system",storageKey:"rmn-ui-theme"/,
    (match, jsx, tag, theme) =>
      `return ${jsx}.jsx(${tag},{window:window.__paddie_router_window,children:${jsx}.jsx(${theme},{defaultTheme:"system",storageKey:"rmn-ui-theme"`,
  )
}

function patch(value: string) {
  return router(route(origin(host(value))))
}

const boot = (token: string, user: AuthUser) => `<script>
(() => {
  const app = ${JSON.stringify(PADDIE_APP_ORIGIN)}
  const token = ${JSON.stringify(token)}
  const user = ${JSON.stringify(
    JSON.stringify({
      id: user.userId,
      email: user.email,
      name: user.email,
      tenant_id: user.tenantId,
    }),
  )}
  const report = (err) => {
    const msg = err && err.message ? err.message : err
    try {
      window.parent.postMessage({ source: "paddie-workflow", type: "error", message: String(msg) }, "*")
    } catch (_) {}
  }

  localStorage.setItem("rmn_token", token)
  localStorage.setItem("rmn_user", user)
  localStorage.setItem("paddie_studio_token", token)
  window.__paddie_app_origin = app

  const loc = new URL("/studio/embed", app)
  const move = (url) => {
    if (!url) return
    loc.href = new URL(String(url), loc.href).href
  }
  const hist = {
    state: { idx: 0 },
    pushState(state, _, url) {
      this.state = state
      move(url)
    },
    replaceState(state, _, url) {
      this.state = state
      move(url)
    },
    go() {},
    back() {},
    forward() {},
  }
  window.__paddie_router_window = {
    document,
    history: hist,
    location: loc,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  }

  const css = document.createElement("style")
  css.textContent = "html,body,#root{height:100%;min-height:100%;width:100%;}body{margin:0;background:#09090b;}#root{background:#09090b;}"
  document.head.appendChild(css)

  const size = () => window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
  window.addEventListener("load", size)
  window.setTimeout(size, 250)
  window.setTimeout(size, 1000)

  try {
    const host = window.parent && window.parent.__paddie_fetch
    if (host) {
      const native = window.fetch.bind(window)
      window.XMLHttpRequest = undefined
      window.fetch = async (input, init) => {
        const req = input instanceof Request ? input : undefined
        const raw = req ? req.url : String(input)
        const url = new URL(raw, app)
        if (url.pathname.startsWith("/api")) {
          const opts = init ? { ...init } : {}
          if (req) {
            opts.method = opts.method || req.method
            opts.headers = opts.headers || Array.from(req.headers.entries())
            if (!opts.body && req.method !== "GET" && req.method !== "HEAD") opts.body = await req.clone().arrayBuffer()
          }
          opts.credentials = "include"
          return host(new URL(url.pathname + url.search + url.hash, app).href, opts)
        }
        return native(input, init)
      }
    }
  } catch (err) {
    report(err)
  }

  window.addEventListener("error", (event) => report(event.message || "Workflow Builder script error"))
  window.addEventListener("unhandledrejection", (event) => report(event.reason || "Workflow Builder promise rejection"))
})()
</script>`

async function text(fetcher: typeof fetch, url: string) {
  const res = await fetcher(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function source(fetcher: typeof fetch, token: string, user: AuthUser) {
  const html = await text(fetcher, WORKFLOW_BUILDER_URL)
  const doc = new DOMParser().parseFromString(html, "text/html")
  const styles = await Promise.all(
    Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]')).map((el) =>
      text(fetcher, new URL(el.getAttribute("href") ?? "", PADDIE_APP_ORIGIN).href),
    ),
  )
  const scripts = await Promise.all(
    Array.from(doc.querySelectorAll("script[src]")).map((el) =>
      text(fetcher, new URL(el.getAttribute("src") ?? "", PADDIE_APP_ORIGIN).href),
    ),
  )
  const patched = scripts.map(patch)
  if (!patched.some((value) => value.includes("__paddie_router_window"))) {
    throw new Error("Workflow Builder router not found")
  }
  if (!patched.some((value) => value.includes(`${PADDIE_APP_ORIGIN}/api`))) {
    throw new Error("Workflow Builder API base not found")
  }

  doc.querySelectorAll('link[rel="stylesheet"][href], script[src]').forEach((el) => el.remove())

  return `<!doctype html>
<html>
<head>
${boot(token, user)}
<base href="${PADDIE_APP_ORIGIN}/">
${doc.head.innerHTML}
${styles.map((css) => `<style>${esc(css)}</style>`).join("\n")}
</head>
${doc.body.outerHTML}
${patched.map((js) => `<script type="module">${esc(js)}</script>`).join("\n")}
</html>`
}

export function WorkflowBuilder() {
  const auth = useAuth()
  const platform = usePlatform()
  let box: HTMLDivElement | undefined
  let frame: HTMLIFrameElement | undefined

  const [doc, api] = createResource(
    () => {
      const token = auth.token()
      const user = auth.user()
      if (!token) return
      if (!user) return
      if (!platform.fetch) return
      return { token, user, fetcher: platform.fetch }
    },
    (input) => source(input.fetcher, input.token, input.user),
  )
  const [fail, setFail] = createSignal<string>()
  const [wide, setWide] = createSignal(false)
  const [zoom, setZoom] = createSignal(50)
  const scale = createMemo(() => zoom() / 100)
  const size = createMemo(() => `${100 / scale()}%`)
  const pct = createMemo(() => `${zoom()}%`)
  const open = () => platform.openLink(WORKFLOW_BUILDER_URL)
  const fit = () => {
    const win = frame?.contentWindow
    if (!win) return
    window.requestAnimationFrame(() => win.dispatchEvent(new Event("resize")))
  }
  const pulse = () => {
    fit()
    window.setTimeout(fit, 150)
    window.setTimeout(fit, 500)
  }
  const refresh = () => {
    setFail()
    if (platform.fetch) {
      void api.refetch()
      pulse()
      return
    }
    if (frame) frame.src = WORKFLOW_BUILDER_URL
    pulse()
  }
  const collapse = () => {
    setWide(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    pulse()
  }
  const expand = () => {
    setWide(true)
    if (box?.requestFullscreen) void box.requestFullscreen().catch(() => undefined)
    pulse()
  }
  const toggle = () => {
    if (wide()) {
      collapse()
      return
    }
    expand()
  }
  const set = (value: number) => setZoom(clamp(value, 25, 200))
  const out = () => set(zoom() - 10)
  const zin = () => set(zoom() + 10)
  const reset = () => set(50)

  createEffect(() => {
    zoom()
    pulse()
  })

  onMount(() => {
    const listen = (event: MessageEvent) => {
      if (frame && event.source !== frame.contentWindow) return
      const data = event.data as { source?: string; type?: string; message?: string }
      if (data.source !== "paddie-workflow") return
      if (data.type !== "error") return
      setFail(data.message || "Workflow Builder failed to render")
    }
    const sync = () => {
      setWide(document.fullscreenElement === box)
      pulse()
    }
    const press = (event: KeyboardEvent) => {
      if (event.key === "Escape" && wide() && document.fullscreenElement !== box) setWide(false)
    }
    window.addEventListener("message", listen)
    document.addEventListener("fullscreenchange", sync)
    window.addEventListener("keydown", press)
    onCleanup(() => {
      window.removeEventListener("message", listen)
      document.removeEventListener("fullscreenchange", sync)
      window.removeEventListener("keydown", press)
    })
  })

  return (
    <div
      ref={box}
      class={`overflow-hidden border border-border-weaker-base bg-surface-base flex flex-col ${
        wide()
          ? "fixed inset-0 z-[9999] min-h-0 rounded-none shadow-none"
          : "h-[calc(100vh-12rem)] min-h-[760px] max-h-[1120px] rounded-[20px] shadow-[var(--shadow-lg-border-base)]"
      }`}
    >
      <div class="min-h-11 shrink-0 border-b border-border-weaker-base bg-[#111218] flex flex-wrap items-center gap-2 px-4 py-2">
        <div class="size-2 rounded-full bg-[#f87171]" />
        <div class="size-2 rounded-full bg-[#fbbf24]" />
        <div class="size-2 rounded-full bg-[#34d399]" />
        <div class="min-w-0 flex-1 text-center text-11-medium text-text-weak truncate">Workflow Builder</div>
        <Button variant="ghost" class="h-7 px-2 text-11-medium" onClick={refresh}>
          Refresh
        </Button>
        <div class="rounded-lg border border-border-weaker-base bg-background-base p-0.5 flex items-center gap-0.5">
          <Button
            variant="ghost"
            class="h-7 w-7 px-0 text-11-medium"
            icon="dash"
            onClick={out}
            disabled={zoom() <= 25}
            aria-label="Zoom out Workflow Builder"
            title="Zoom out Workflow Builder"
          />
          <Button
            variant="ghost"
            class="h-7 min-w-12 px-2 text-11-medium"
            onClick={reset}
            aria-label="Reset Workflow Builder zoom to 50%"
            title="Reset Workflow Builder zoom to 50%"
          >
            {pct()}
          </Button>
          <Button
            variant="ghost"
            class="h-7 w-7 px-0 text-11-medium"
            icon="plus-small"
            onClick={zin}
            disabled={zoom() >= 200}
            aria-label="Zoom in Workflow Builder"
            title="Zoom in Workflow Builder"
          />
        </div>
        <Button variant="ghost" class="h-7 px-2 text-11-medium" onClick={toggle}>
          {wide() ? "Exit fullscreen" : "Fullscreen"}
        </Button>
        <Button variant="ghost" class="h-7 px-2 text-11-medium" onClick={open}>
          Open in browser
        </Button>
      </div>

      <Show
        when={!doc.error}
        fallback={
          <div class="min-h-0 flex-1 p-4 flex items-center justify-center text-center">
            <div class="max-w-md">
              <div class="text-14-medium text-text-base">Workflow Builder could not load</div>
              <div class="mt-2 text-12-medium text-text-weak">
                {doc.error instanceof Error ? doc.error.message : "The embedded studio did not respond."}
              </div>
              <Button class="mt-4 h-9 px-3 text-12-medium" onClick={refresh}>
                Retry
              </Button>
            </div>
          </div>
        }
      >
        <Show
          when={!platform.fetch || doc()}
          fallback={
            <div class="min-h-0 flex-1 flex items-center justify-center text-13-medium text-text-weak">
              Loading Workflow Builder...
            </div>
          }
        >
          <div class="relative min-h-0 flex-1 overflow-hidden bg-[#09090b]">
            <iframe
              ref={frame}
              onLoad={pulse}
              src={platform.fetch ? undefined : WORKFLOW_BUILDER_URL}
              srcdoc={platform.fetch ? doc() : undefined}
              class="absolute left-0 top-0 block border-0 bg-[#09090b]"
              style={{
                width: size(),
                height: size(),
                transform: `scale(${scale()})`,
                "transform-origin": "top left",
              }}
              title="Workflow Builder"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
            <Show when={fail()}>
              {(msg) => (
                <div class="pointer-events-none absolute right-3 bottom-3 z-10 max-w-[min(420px,calc(100%-1.5rem))]">
                  <div class="pointer-events-auto rounded-lg border border-border-weaker-base bg-surface-raised-base/95 p-3 text-left shadow-[var(--shadow-lg-border-base)] backdrop-blur">
                    <div class="text-12-medium text-text-base">Workflow Builder notice</div>
                    <div class="mt-1 line-clamp-3 text-11-medium text-text-weak">{msg()}</div>
                    <div class="mt-3 flex items-center justify-end gap-2">
                      <Button variant="ghost" class="h-7 px-2 text-11-medium" onClick={() => setFail()}>
                        Dismiss
                      </Button>
                      <Button class="h-7 px-2 text-11-medium" onClick={refresh}>
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  )
}
