import type { Config, McpLocalConfig, McpRemoteConfig, McpStatus } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { Tag } from "@opencode-ai/ui/tag"
import { Switch } from "@opencode-ai/ui/switch"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { For, Show, createMemo, onMount, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"

type Mode = "remote" | "local"
type McpMap = NonNullable<Config["mcp"]>
type McpEntry = McpMap[string]
type McpConfig = McpLocalConfig | McpRemoteConfig
type McpState = McpStatus["status"]

const FEATURED = [
  {
    name: "playwright",
    title: "Playwright",
    description: "Browser automation tools for testing, scraping, and repros.",
    icon: "window-cursor",
    panel: "linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(15, 23, 42, 0.04))",
    glow: "rgba(96, 165, 250, 0.18)",
    badge: "rgba(37, 99, 235, 0.14)",
    color: "rgb(37, 99, 235)",
    config: {
      type: "local",
      command: ["npx", "-y", "@playwright/mcp@latest"],
    },
  },
  {
    name: "context7",
    title: "Context7",
    description: "Fresh framework docs and API references in one remote server.",
    icon: "code-lines",
    panel: "linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(15, 23, 42, 0.04))",
    glow: "rgba(56, 189, 248, 0.2)",
    badge: "rgba(8, 145, 178, 0.14)",
    color: "rgb(8, 145, 178)",
    config: {
      type: "remote",
      url: "https://mcp.context7.com/mcp",
    },
  },
  {
    name: "linear",
    title: "Linear",
    description: "Issue and project workflows from your Linear workspace.",
    icon: "branch",
    panel: "linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(30, 41, 59, 0.04))",
    glow: "rgba(139, 92, 246, 0.18)",
    badge: "rgba(109, 40, 217, 0.14)",
    color: "rgb(109, 40, 217)",
    config: {
      type: "remote",
      url: "https://mcp.linear.app/sse",
      oauth: {},
    },
  },
  {
    name: "sentry",
    title: "Sentry",
    description: "Error monitoring, traces, and issue triage in one place.",
    icon: "warning",
    panel: "linear-gradient(135deg, rgba(14, 116, 144, 0.16), rgba(15, 23, 42, 0.04))",
    glow: "rgba(6, 182, 212, 0.16)",
    badge: "rgba(8, 145, 178, 0.14)",
    color: "rgb(8, 145, 178)",
    config: {
      type: "remote",
      url: "https://mcp.sentry.dev/mcp",
      oauth: {},
    },
  },
] satisfies Array<{
  name: string
  title: string
  description: string
  icon: IconProps["name"]
  panel: string
  glow: string
  badge: string
  color: string
  config: McpConfig
}>

const STATUS = {
  connected: "mcp.status.connected",
  failed: "mcp.status.failed",
  needs_auth: "mcp.status.needs_auth",
  disabled: "mcp.status.disabled",
  needs_client_registration: "settings.mcp.status.needs_client_registration",
} satisfies Record<McpState, string>

const empty = (mode: Mode = "remote") => ({
  mode,
  name: "",
  url: "",
  command: "",
  headers: "",
  environment: "",
  timeout: "",
})

const isConfig = (value: McpEntry | undefined): value is McpConfig =>
  typeof value === "object" && value !== null && "type" in value

const split = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const parseMap = (value: string, allowColon: boolean) => {
  const out: Record<string, string> = {}

  for (const line of split(value)) {
    const eq = line.indexOf("=")
    const cut = !allowColon ? eq : ([line.indexOf(":"), eq].filter((part) => part > 0).sort((a, b) => a - b)[0] ?? -1)

    if (cut < 1) return { error: line }

    const key = line.slice(0, cut).trim()
    const item = line.slice(cut + 1).trim()
    if (!key || !item) return { error: line }
    out[key] = item
  }

  return { value: Object.keys(out).length > 0 ? out : undefined }
}

const parseCmd = (value: string) =>
  (value.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map((part) => {
    if (part.startsWith('"') && part.endsWith('"')) return part.slice(1, -1)
    if (part.startsWith("'") && part.endsWith("'")) return part.slice(1, -1)
    return part
  })

export const SettingsMcp: Component = () => {
  const lang = useLanguage()
  const sdk = useGlobalSDK()
  const sync = useGlobalSync()
  const [state, setState] = createStore({
    form: empty(),
    submitting: "",
    statusLoading: false,
    status: {} as Record<string, McpStatus>,
  })

  const busy = createMemo(() => state.submitting.length > 0)

  const items = createMemo(() => {
    return Object.entries(sync.data.config.mcp ?? {})
      .filter((item): item is [string, McpConfig] => isConfig(item[1]))
      .map(([name, config]) => ({ name, config }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const names = createMemo(() => new Set(items().map((item) => item.name)))

  const spin = () => `${lang.t("common.loading")}${lang.t("common.loading.ellipsis")}`

  const kind = (value: Mode) => {
    if (value === "remote") return lang.t("settings.mcp.type.remote")
    return lang.t("settings.mcp.type.local")
  }

  const fail = (description: string) => {
    showToast({
      variant: "error",
      title: lang.t("common.requestFailed"),
      description,
    })
  }

  const load = () => {
    setState("statusLoading", true)
    return sdk.client.mcp
      .status()
      .then((x) => {
        setState("status", x.data ?? {})
      })
      .catch(() => undefined)
      .finally(() => {
        setState("statusLoading", false)
      })
  }

  const save = (next: McpMap, job: string, onSuccess: () => void, title: string, description: string) => {
    const prev = sync.data.config.mcp
    setState("submitting", job)
    sync.set("config", "mcp", next)

    sync
      .updateConfig({ mcp: next })
      .then(() => {
        onSuccess()
        void load()
        showToast({
          variant: "success",
          icon: "circle-check",
          title,
          description,
        })
      })
      .catch((err: unknown) => {
        sync.set("config", "mcp", prev)
        fail(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setState("submitting", "")
      })
  }

  const add = (name: string, config: McpConfig, job: string, reset: boolean) => {
    const key = name.trim()
    if (!key) {
      fail(lang.t("settings.mcp.validation.name"))
      return
    }

    if (names().has(key)) {
      fail(lang.t("settings.mcp.validation.duplicate", { name: key }))
      return
    }

    const next = {
      ...(sync.data.config.mcp ?? {}),
      [key]: config,
    }

    save(
      next,
      job,
      () => {
        if (!reset) return
        setState("form", empty(state.form.mode))
      },
      lang.t("settings.mcp.toast.added.title"),
      lang.t("settings.mcp.toast.added.description", { name: key }),
    )
  }

  const addForm = () => {
    if (busy()) return

    const timeout = state.form.timeout.trim()
    const wait = timeout ? Number(timeout) : undefined
    if (wait !== undefined && (!Number.isInteger(wait) || wait <= 0)) {
      fail(lang.t("settings.mcp.validation.timeout"))
      return
    }

    if (state.form.mode === "remote") {
      const url = state.form.url.trim()
      if (!url) {
        fail(lang.t("settings.mcp.validation.url"))
        return
      }

      const headers = parseMap(state.form.headers, true)
      if (headers.error) {
        fail(lang.t("settings.mcp.validation.headers", { line: headers.error }))
        return
      }

      add(
        state.form.name,
        {
          type: "remote",
          url,
          ...(headers.value ? { headers: headers.value } : {}),
          ...(wait ? { timeout: wait } : {}),
        },
        "form",
        true,
      )
      return
    }

    const command = parseCmd(state.form.command.trim())
    if (command.length === 0) {
      fail(lang.t("settings.mcp.validation.command"))
      return
    }

    const environment = parseMap(state.form.environment, false)
    if (environment.error) {
      fail(lang.t("settings.mcp.validation.environment", { line: environment.error }))
      return
    }

    add(
      state.form.name,
      {
        type: "local",
        command,
        ...(environment.value ? { environment: environment.value } : {}),
        ...(wait ? { timeout: wait } : {}),
      },
      "form",
      true,
    )
  }

  const addFeatured = (item: (typeof FEATURED)[number]) => {
    if (busy()) return
    add(item.name, item.config, `featured:${item.name}`, false)
  }

  const toggle = (name: string, enabled: boolean) => {
    if (busy()) return
    const current = (sync.data.config.mcp ?? {})[name]
    if (!isConfig(current)) return

    const next = {
      ...(sync.data.config.mcp ?? {}),
      [name]: {
        ...current,
        enabled,
      },
    }

    save(
      next,
      `toggle:${name}`,
      () => undefined,
      lang.t("settings.mcp.toast.updated.title"),
      lang.t("settings.mcp.toast.updated.description", {
        name,
        state: enabled ? lang.t("settings.mcp.state.enabled") : lang.t("settings.mcp.state.disabled"),
      }),
    )
  }

  const remove = (name: string) => {
    if (busy()) return

    const next = { ...(sync.data.config.mcp ?? {}) }
    delete next[name]

    save(
      next,
      `remove:${name}`,
      () => undefined,
      lang.t("settings.mcp.toast.removed.title"),
      lang.t("settings.mcp.toast.removed.description", { name }),
    )
  }

  const label = (name: string) => {
    const value = state.status[name]?.status
    if (!value) return
    return lang.t(STATUS[value])
  }

  const issue = (name: string) => {
    const value = state.status[name]
    if (!value || !("error" in value)) return
    return value.error
  }

  const line = (config: McpConfig) => {
    if (config.type === "remote") return config.url
    return config.command.join(" ")
  }

  onMount(() => {
    void load()
  })

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8 max-w-[720px]">
          <h2 class="text-16-medium text-text-strong">{lang.t("settings.mcp.title")}</h2>
          <p class="text-14-regular text-text-weak">{lang.t("settings.mcp.description")}</p>
        </div>
      </div>

      <div class="flex flex-col gap-8 max-w-[720px]">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <h3 class="text-14-medium text-text-strong">{lang.t("settings.mcp.section.featured")}</h3>
            <p class="text-12-regular text-text-weak">{lang.t("settings.mcp.section.featured.description")}</p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <For each={FEATURED}>
              {(item) => {
                const added = () => names().has(item.name)
                const pending = () => state.submitting === `featured:${item.name}`

                return (
                  <button
                    type="button"
                    class="group relative overflow-hidden rounded-2xl border border-border-weak-base p-4 text-left transition-transform duration-200 disabled:cursor-default"
                    classList={{
                      "hover:-translate-y-0.5": !added() && !busy(),
                      "opacity-60": added(),
                    }}
                    disabled={added() || busy()}
                    onClick={() => addFeatured(item)}
                  >
                    <div class="absolute inset-0" aria-hidden="true">
                      <div class="absolute inset-0" style={{ background: item.panel }} />
                      <div
                        class="absolute -right-6 -top-6 size-24 rounded-full blur-2xl"
                        style={{ background: item.glow }}
                      />
                    </div>

                    <div class="relative flex flex-col gap-4">
                      <div class="flex items-start justify-between gap-3">
                        <div
                          class="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border-weak-base"
                          style={{ background: item.badge, color: item.color }}
                        >
                          <Icon name={item.icon} class="size-5" />
                        </div>
                        <span class="rounded-full bg-surface-base px-2.5 py-1 text-11-medium text-text-weak">
                          {kind(item.config.type)}
                        </span>
                      </div>

                      <div class="flex flex-col gap-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-14-medium text-text-strong">{item.title}</span>
                          <Show when={added()}>
                            <span class="rounded-full bg-surface-base px-2 py-0.5 text-11-medium text-text-weak">
                              {lang.t("settings.mcp.featured.added")}
                            </span>
                          </Show>
                          <Show when={pending()}>
                            <span class="text-11-regular text-text-weak">{spin()}</span>
                          </Show>
                        </div>
                        <span class="text-12-regular leading-5 text-text-weak">{item.description}</span>
                      </div>
                    </div>
                  </button>
                )
              }}
            </For>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-14-medium text-text-strong">{lang.t("settings.mcp.section.configured")}</h3>
              <Show when={state.statusLoading}>
                <span class="text-11-regular text-text-weak">{spin()}</span>
              </Show>
            </div>
            <p class="text-12-regular text-text-weak">{lang.t("settings.mcp.section.configured.description")}</p>
          </div>

          <div class="bg-surface-raised-base px-4 rounded-lg">
            <Show
              when={items().length > 0}
              fallback={<div class="py-4 text-14-regular text-text-weak">{lang.t("dialog.mcp.empty")}</div>}
            >
              <For each={items()}>
                {(item) => {
                  const current = () => state.status[item.name]?.status
                  const text = () => label(item.name)
                  const problem = () => issue(item.name)
                  const enabled = () => item.config.enabled !== false
                  const pendingToggle = () => state.submitting === `toggle:${item.name}`
                  const pending = () => state.submitting === `remove:${item.name}`

                  return (
                    <div class="flex flex-wrap items-start justify-between gap-4 py-4 border-b border-border-weak-base last:border-none">
                      <div class="min-w-0 flex-1 flex flex-col gap-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-14-medium text-text-strong">{item.name}</span>
                          <Tag>{kind(item.config.type)}</Tag>
                          <Show when={text()}>
                            <span
                              class="rounded-full bg-surface-base px-2 py-0.5 text-11-medium"
                              classList={{
                                "text-icon-success-base": current() === "connected",
                                "text-icon-warning-base": current() === "needs_auth",
                                "text-icon-critical-base":
                                  current() === "failed" || current() === "needs_client_registration",
                                "text-text-weak": current() === "disabled",
                              }}
                            >
                              {text()}
                            </span>
                          </Show>
                        </div>

                        <span class="text-12-regular text-text-weak break-all">{line(item.config)}</span>

                        <Show when={problem()}>
                          <span class="text-12-regular text-icon-critical-base break-all">{problem()}</span>
                        </Show>
                      </div>

                      <div class="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <div class="flex items-center gap-2 pl-1">
                          <Show when={pendingToggle()}>
                            <span class="text-11-regular text-text-weak">{spin()}</span>
                          </Show>
                          <Switch
                            checked={enabled()}
                            disabled={busy()}
                            onChange={(next) => toggle(item.name, next)}
                            hideLabel
                          >
                            {item.name}
                          </Switch>
                          <span class="text-12-regular text-text-weak">
                            {enabled() ? lang.t("settings.mcp.state.enabled") : lang.t("settings.mcp.state.disabled")}
                          </span>
                        </div>

                        <Button size="large" variant="ghost" disabled={busy()} onClick={() => remove(item.name)}>
                          {pending() ? spin() : lang.t("settings.mcp.action.remove")}
                        </Button>
                      </div>
                    </div>
                  )
                }}
              </For>
            </Show>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <h3 class="text-14-medium text-text-strong">{lang.t("settings.mcp.section.add")}</h3>
            <p class="text-12-regular text-text-weak">{lang.t("settings.mcp.section.add.description")}</p>
          </div>

          <div class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-4 sm:p-5">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <span class="text-12-medium text-text-strong">{lang.t("settings.mcp.form.type.label")}</span>
                <div class="inline-flex w-full gap-1 rounded-xl bg-surface-base p-1 sm:w-auto">
                  <For each={["remote", "local"] as const}>
                    {(mode) => (
                      <button
                        type="button"
                        class="h-9 flex-1 rounded-lg px-3 text-12-medium transition-colors sm:flex-none"
                        classList={{
                          "bg-surface-raised-base text-text-strong": state.form.mode === mode,
                          "text-text-weak": state.form.mode !== mode,
                        }}
                        onClick={() => {
                          if (busy()) return
                          setState("form", "mode", mode)
                        }}
                      >
                        {kind(mode)}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={lang.t("settings.mcp.form.name.label")}
                  value={state.form.name}
                  onChange={(value) => setState("form", "name", value)}
                  placeholder={lang.t("settings.mcp.form.name.placeholder")}
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                />

                <TextField
                  label={lang.t("settings.mcp.form.timeout.label")}
                  value={state.form.timeout}
                  onChange={(value) => setState("form", "timeout", value)}
                  placeholder={lang.t("settings.mcp.form.timeout.placeholder")}
                  inputMode="numeric"
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                />
              </div>

              <Show
                when={state.form.mode === "remote"}
                fallback={
                  <>
                    <TextField
                      label={lang.t("settings.mcp.form.command.label")}
                      value={state.form.command}
                      onChange={(value) => setState("form", "command", value)}
                      placeholder={lang.t("settings.mcp.form.command.placeholder")}
                      spellcheck={false}
                      autocorrect="off"
                      autocomplete="off"
                      autocapitalize="off"
                    />

                    <TextField
                      label={lang.t("settings.mcp.form.environment.label")}
                      description={lang.t("settings.mcp.form.environment.description")}
                      value={state.form.environment}
                      onChange={(value) => setState("form", "environment", value)}
                      placeholder="API_KEY={env:API_KEY}"
                      multiline
                      rows={4}
                      spellcheck={false}
                      autocorrect="off"
                      autocomplete="off"
                      autocapitalize="off"
                    />
                  </>
                }
              >
                <TextField
                  label={lang.t("settings.mcp.form.url.label")}
                  value={state.form.url}
                  onChange={(value) => setState("form", "url", value)}
                  placeholder={lang.t("settings.mcp.form.url.placeholder")}
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                />

                <TextField
                  label={lang.t("settings.mcp.form.headers.label")}
                  description={lang.t("settings.mcp.form.headers.description")}
                  value={state.form.headers}
                  onChange={(value) => setState("form", "headers", value)}
                  placeholder="Authorization: Bearer {env:API_KEY}"
                  multiline
                  rows={4}
                  spellcheck={false}
                  autocorrect="off"
                  autocomplete="off"
                  autocapitalize="off"
                />
              </Show>

              <Button
                size="large"
                variant="secondary"
                icon="plus-small"
                class="w-full justify-center sm:w-auto"
                disabled={busy()}
                onClick={addForm}
              >
                {state.submitting === "form" ? spin() : lang.t("settings.mcp.action.add")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
