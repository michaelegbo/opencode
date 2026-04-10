import { For, Show, createMemo, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import { createSortable } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { Button } from "@opencode-ai/ui/button"
import { DockTray } from "@opencode-ai/ui/dock-surface"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"

function Row(props: {
  item: { id: string; text: string }
  disabled: boolean
  onSend: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}): JSX.Element {
  const language = useLanguage()
  const sortable = createSortable(props.item.id)

  return (
    <div use:sortable class="min-w-0" classList={{ "opacity-0": sortable.isActiveDraggable }}>
      <div
        class="flex items-center gap-2 min-w-0 py-1"
        classList={{
          "cursor-default": props.disabled,
          "cursor-grab active:cursor-grabbing": !props.disabled,
        }}
      >
        <span class="min-w-0 flex-1 truncate text-13-regular text-text-strong">{props.item.text}</span>
        <Button
          size="small"
          variant="secondary"
          class="shrink-0"
          disabled={props.disabled}
          onClick={() => props.onSend(props.item.id)}
        >
          {language.t("session.followupDock.sendNow")}
        </Button>
        <Button
          size="small"
          variant="ghost"
          class="shrink-0"
          disabled={props.disabled}
          onClick={() => props.onEdit(props.item.id)}
        >
          {language.t("session.followupDock.edit")}
        </Button>
        <Button
          size="small"
          variant="ghost"
          class="shrink-0"
          disabled={props.disabled}
          onClick={() => props.onDelete(props.item.id)}
        >
          {language.t("common.delete")}
        </Button>
      </div>
    </div>
  )
}

export function SessionFollowupDock(props: {
  items: { id: string; text: string }[]
  sending?: string
  onSend: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (from: string, to: string) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    collapsed: false,
    active: undefined as string | undefined,
  })

  const toggle = () => setStore("collapsed", (value) => !value)
  const total = createMemo(() => props.items.length)
  const label = createMemo(() =>
    language.t(total() === 1 ? "session.followupDock.summary.one" : "session.followupDock.summary.other", {
      count: total(),
    }),
  )
  const preview = createMemo(() => props.items[0]?.text ?? "")
  const ids = createMemo(() => props.items.map((item) => item.id))
  const disabled = createMemo(() => !!props.sending)

  const start = (event: unknown) => {
    if (disabled()) return
    const id = getDraggableId(event)
    if (!id) return
    setStore("active", id)
  }

  const over = (event: DragEvent) => {
    const from = event.draggable?.id?.toString()
    const to = event.droppable?.id?.toString()
    if (!from || !to || from === to || disabled()) return
    props.onReorder(from, to)
  }

  const end = () => {
    setStore("active", undefined)
  }

  return (
    <DockTray
      data-component="session-followup-dock"
      style={{
        "margin-bottom": "-0.875rem",
        "border-bottom-left-radius": 0,
        "border-bottom-right-radius": 0,
      }}
    >
      <div
        class="pl-3 pr-2 py-2 flex items-center gap-2"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          toggle()
        }}
      >
        <span class="shrink-0 text-13-medium text-text-strong cursor-default">{label()}</span>
        <Show when={store.collapsed && preview()}>
          <span class="min-w-0 flex-1 truncate text-13-regular text-text-base cursor-default">{preview()}</span>
        </Show>
        <div class="ml-auto shrink-0">
          <IconButton
            data-collapsed={store.collapsed ? "true" : "false"}
            icon="chevron-down"
            size="normal"
            variant="ghost"
            style={{ transform: `rotate(${store.collapsed ? 180 : 0}deg)` }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
            aria-label={
              store.collapsed ? language.t("session.followupDock.expand") : language.t("session.followupDock.collapse")
            }
          />
        </div>
      </div>

      <Show when={store.collapsed}>
        <div class="h-5" aria-hidden="true" />
      </Show>

      <Show when={!store.collapsed}>
        <DragDropProvider onDragStart={start} onDragOver={over} onDragEnd={end} collisionDetector={closestCenter}>
          <DragDropSensors />
          <ConstrainDragYAxis />
          <div class="px-3 pb-7 flex flex-col gap-1.5 max-h-42 overflow-y-auto no-scrollbar">
            <SortableProvider ids={ids()}>
              <For each={props.items}>
                {(item) => (
                  <Row
                    item={item}
                    disabled={disabled()}
                    onSend={props.onSend}
                    onEdit={props.onEdit}
                    onDelete={props.onDelete}
                  />
                )}
              </For>
            </SortableProvider>
          </div>
          <DragOverlay>
            <Show when={store.active}>
              {(id) => (
                <Show when={props.items.find((item) => item.id === id())}>
                  {(item) => (
                    <div class="px-3 py-2 rounded-md border border-border-weak-base bg-background-base text-13-regular text-text-strong shadow-sm">
                      {item().text}
                    </div>
                  )}
                </Show>
              )}
            </Show>
          </DragOverlay>
        </DragDropProvider>
      </Show>
    </DockTray>
  )
}
