import { Show, type Component } from "solid-js"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Icon } from "@opencode-ai/ui/icon"

type Range = {
  start: number
  end: number
}

type CommentChipProps = {
  variant?: "preview" | "full"
  path: string
  label: string
  selection?: Range
  comment?: string
  class?: string
  onOpen?: () => void
  onRemove?: () => void
  removeLabel?: string
}

const removeClass =
  "absolute top-0 right-0 size-6 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
const removeIconClass =
  "absolute top-1 right-1 size-3.5 rounded-[var(--radius-sm)] flex items-center justify-center bg-transparent group-hover/remove:bg-surface-base-hover group-active/remove:bg-surface-base-active"

export const CommentChip: Component<CommentChipProps> = (props) => {
  const variant = () => props.variant ?? "preview"
  const range = () => {
    const sel = props.selection
    if (!sel) return
    const start = Math.min(sel.start, sel.end)
    const end = Math.max(sel.start, sel.end)
    return { start, end }
  }

  const pad = () => (props.onRemove ? "pr-7" : "pr-2")

  return (
    <div
      class={`group relative flex flex-col rounded-[6px] cursor-default bg-background-stronger border border-border-weak-base ${
        variant() === "full" ? `pl-2 py-1 ${pad()}` : `pl-2 py-1 h-12 ${pad()}`
      } ${props.class ?? ""}`}
      onClick={() => props.onOpen?.()}
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <FileIcon node={{ path: props.path, type: "file" }} class="shrink-0 size-3.5" />
        <div class="flex items-center text-11-regular min-w-0 font-medium">
          <span class="text-text-strong whitespace-nowrap">{props.label}</span>
          <Show when={range()}>
            {(sel) => (
              <span class="text-text-weak whitespace-nowrap shrink-0">
                {sel().start === sel().end ? `:${sel().start}` : `:${sel().start}-${sel().end}`}
              </span>
            )}
          </Show>
        </div>
      </div>
      <Show when={(props.comment ?? "").trim().length > 0}>
        <div
          class={`text-base text-text-strong ml-5 ${
            variant() === "full" ? "whitespace-pre-wrap break-words" : "truncate"
          }`}
        >
          {props.comment}
        </div>
      </Show>
      <Show when={props.onRemove}>
        <button
          type="button"
          class={`${removeClass} group/remove`}
          onClick={(e) => {
            e.stopPropagation()
            props.onRemove?.()
          }}
          aria-label={props.removeLabel}
        >
          <span class={removeIconClass}>
            <Icon name="close-small" size="small" class="text-text-weak group-hover/remove:text-text-strong" />
          </span>
        </button>
      </Show>
    </div>
  )
}
