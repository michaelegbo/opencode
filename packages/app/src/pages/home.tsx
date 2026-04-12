import { createMemo, For, Match, Show, Switch } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Logo } from "@opencode-ai/ui/logo"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { materialize } from "@/template/helpers"
import type { UITemplate } from "@/template/helpers"
import { paddieApi, UpgradeRequiredError } from "@/lib/paddie-api"
import { useAuth } from "@/context/auth"

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "landing-page"

export default function Home() {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const language = useLanguage()
  const auth = useAuth()
  const homedir = createMemo(() => sync.data.path.home)
  const recent = createMemo(() => {
    return sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5)
  })

  const serverDotClass = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "bg-icon-success-base"
    if (healthy === false) return "bg-icon-critical-base"
    return "bg-border-weak-base"
  })

  function openProject(directory: string) {
    layout.projects.open(directory)
    server.projects.touch(directory)
    navigate(`/${base64Encode(directory)}`)
  }

  async function createProject() {
    const fs = platform.workbench
    if (!fs || !platform.openDirectoryPickerDialog || !server.isLocal()) {
      showToast({
        variant: "error",
        title: "Template starters need the desktop app",
      })
      return
    }

    if (!auth.isAuthenticated()) {
      showToast({ variant: "error", title: "Sign in to access templates" })
      return
    }

    let tpl: UITemplate
    try {
      const listing = await paddieApi.get<{ id: string }[]>("/studio/ui-templates")
      if (!listing.length) {
        showToast({ variant: "error", title: "No templates available" })
        return
      }
      tpl = await paddieApi.get<UITemplate>(`/studio/ui-templates/${listing[0].id}`)
    } catch (err) {
      if (err instanceof UpgradeRequiredError) {
        showToast({ variant: "error", title: "Upgrade required", description: `This template requires the ${err.required_tier} plan.` })
        return
      }
      showToast({ variant: "error", title: "Failed to load template" })
      return
    }

    const parent = await platform.openDirectoryPickerDialog({
      title: "Choose a parent folder",
      multiple: false,
    })
    const root = Array.isArray(parent) ? parent[0] : parent
    if (!root) return

    const raw = window.prompt("Project name", slug(tpl.name))
    const name = raw?.trim()
    if (!name) return

    const next = await fs
      .create({ parent: root, name: slug(name), files: materialize(tpl, name) })
      .catch((err) => {
        showToast({
          variant: "error",
          title: "Could not create project",
          description: err instanceof Error ? err.message : String(err),
        })
        return
      })
    if (!next) return
    openProject(next)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) {
          openProject(directory)
        }
      } else if (result) {
        openProject(result)
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  return (
    <div class="mx-auto mt-55 w-full md:w-auto px-4">
      <Logo class="md:w-xl opacity-12" />
      <Button
        size="large"
        variant="ghost"
        class="mt-4 mx-auto text-14-regular text-text-weak"
        onClick={() => dialog.show(() => <DialogSelectServer />)}
      >
        <div
          classList={{
            "size-2 rounded-full": true,
            [serverDotClass()]: true,
          }}
        />
        {server.name}
      </Button>
      <Switch>
        <Match when={sync.data.project.length > 0}>
          <div class="mt-20 w-full flex flex-col gap-4">
            <div class="flex gap-2 items-center justify-between pl-3">
              <div class="text-14-medium text-text-strong">{language.t("home.recentProjects")}</div>
              <Button icon="folder-add-left" size="normal" class="pl-2 pr-3" onClick={chooseProject}>
                {language.t("command.project.open")}
              </Button>
              <Show when={platform.workbench && server.isLocal()}>
                <Button icon="layout-right-full" size="normal" class="pl-2 pr-3" onClick={() => void createProject()}>
                  Create from template
                </Button>
              </Show>
            </div>
            <ul class="flex flex-col gap-2">
              <For each={recent()}>
                {(project) => (
                  <Button
                    size="large"
                    variant="ghost"
                    class="text-14-mono text-left justify-between px-3"
                    onClick={() => openProject(project.worktree)}
                  >
                    {project.worktree.replace(homedir(), "~")}
                    <div class="text-14-regular text-text-weak">
                      {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                    </div>
                  </Button>
                )}
              </For>
            </ul>
          </div>
        </Match>
        <Match when={!sync.ready}>
            <div class="mt-30 mx-auto flex flex-col items-center gap-3">
              <div class="text-12-regular text-text-weak">{language.t("common.loading")}</div>
              <Button class="px-3" onClick={chooseProject}>
                {language.t("command.project.open")}
              </Button>
              <Show when={platform.workbench && server.isLocal()}>
                <Button class="px-3" variant="ghost" onClick={() => void createProject()}>
                  Create from template
                </Button>
              </Show>
            </div>
          </Match>
        <Match when={true}>
          <div class="mt-30 mx-auto flex flex-col items-center gap-3">
            <Icon name="folder-add-left" size="large" />
            <div class="flex flex-col gap-1 items-center justify-center">
              <div class="text-14-medium text-text-strong">{language.t("home.empty.title")}</div>
              <div class="text-12-regular text-text-weak">{language.t("home.empty.description")}</div>
            </div>
            <Button class="px-3 mt-1" onClick={chooseProject}>
              {language.t("command.project.open")}
            </Button>
            <Show when={platform.workbench && server.isLocal()}>
              <Button class="px-3" variant="ghost" onClick={() => void createProject()}>
                Create from template
              </Button>
            </Show>
          </div>
        </Match>
      </Switch>
    </div>
  )
}
