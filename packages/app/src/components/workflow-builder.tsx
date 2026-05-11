import { Button } from "@opencode-ai/ui/button"
import { createResource, Show } from "solid-js"
import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { PADDIE_APP_ORIGIN, WORKFLOW_BUILDER_URL } from "@/lib/paddie-links"

const esc = (value: string) => value.replace(/<\/(script|style)/gi, "<\\/$1")

async function text(fetcher: typeof fetch, url: string) {
  const res = await fetcher(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function source(fetcher: typeof fetch, token: string) {
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

  doc.querySelectorAll('link[rel="stylesheet"][href], script[src]').forEach((el) => el.remove())

  return `<!doctype html>
<html>
<head>
<script>
history.replaceState(null, "", "/studio/fullscreen");
localStorage.setItem("rmn_token", ${JSON.stringify(token)});
localStorage.setItem("paddie_studio_token", ${JSON.stringify(token)});
</script>
<base href="${PADDIE_APP_ORIGIN}/">
${doc.head.innerHTML}
${styles.map((css) => `<style>${esc(css)}</style>`).join("\n")}
</head>
${doc.body.outerHTML}
${scripts.map((js) => `<script type="module">${esc(js)}</script>`).join("\n")}
</html>`
}

export function WorkflowBuilder() {
  const auth = useAuth()
  const platform = usePlatform()
  let frame: HTMLIFrameElement | undefined

  const [doc, api] = createResource(
    () => {
      const token = auth.token()
      if (!token) return
      if (!platform.fetch) return
      return { token, fetcher: platform.fetch }
    },
    (input) => source(input.fetcher, input.token),
  )
  const open = () => platform.openLink(WORKFLOW_BUILDER_URL)
  const refresh = () => {
    if (platform.fetch) {
      void api.refetch()
      return
    }
    if (frame) frame.src = WORKFLOW_BUILDER_URL
  }

  return (
    <div class="min-h-[720px] overflow-hidden rounded-[20px] border border-border-weaker-base bg-surface-base shadow-[var(--shadow-lg-border-base)] flex flex-col">
      <div class="min-h-11 shrink-0 border-b border-border-weaker-base bg-[#111218] flex flex-wrap items-center gap-2 px-4 py-2">
        <div class="size-2 rounded-full bg-[#f87171]" />
        <div class="size-2 rounded-full bg-[#fbbf24]" />
        <div class="size-2 rounded-full bg-[#34d399]" />
        <div class="min-w-0 flex-1 text-center text-11-medium text-text-weak truncate">Workflow Builder</div>
        <Button variant="ghost" class="h-7 px-2 text-11-medium" onClick={refresh}>
          Refresh
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
          <iframe
            ref={frame}
            src={platform.fetch ? undefined : WORKFLOW_BUILDER_URL}
            srcdoc={platform.fetch ? doc() : undefined}
            class="block min-h-0 flex-1 w-full border-0 bg-white"
            title="Workflow Builder"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        </Show>
      </Show>
    </div>
  )
}
