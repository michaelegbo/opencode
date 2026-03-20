import { Component, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import type { ImageAttachmentPart } from "@/context/prompt"

type PromptImageAttachmentsProps = {
  attachments: ImageAttachmentPart[]
  onOpen: (attachment: ImageAttachmentPart) => void
  onRemove: (id: string) => void
  removeLabel: string
}

type PromptImageAttachmentProps = {
  attachment: ImageAttachmentPart
  onOpen: (attachment: ImageAttachmentPart) => void
  onRemove: (id: string) => void
  removeLabel: string
}

const fallbackClass =
  "size-12 rounded-[6px] bg-background-stronger flex items-center justify-center border border-border-weak-base cursor-default"
const imageClass = "size-12 rounded-[6px] object-cover border border-border-weak-base"
const removeClass =
  "absolute top-0 right-0 size-6 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
const removeIconClass =
  "absolute top-1 right-1 size-3.5 rounded-[var(--radius-sm)] flex items-center justify-center bg-transparent group-hover/remove:bg-surface-base-hover group-active/remove:bg-surface-base-active"

export const PromptImageAttachments: Component<PromptImageAttachmentsProps> = (props) => {
  return (
    <Show when={props.attachments.length > 0}>
      <>
        {props.attachments.map((attachment) => (
          <PromptImageAttachment
            attachment={attachment}
            onOpen={props.onOpen}
            onRemove={props.onRemove}
            removeLabel={props.removeLabel}
          />
        ))}
      </>
    </Show>
  )
}

export const PromptImageAttachment: Component<PromptImageAttachmentProps> = (props) => {
  return (
    <Tooltip value={props.attachment.filename} placement="top" gutter={6} class="shrink-0">
      <div class="relative group">
        <Show
          when={props.attachment.mime.startsWith("image/")}
          fallback={
            <div class={fallbackClass}>
              <FileIcon node={{ path: props.attachment.filename, type: "file" }} class="size-5" />
            </div>
          }
        >
          <img
            src={props.attachment.dataUrl}
            alt={props.attachment.filename}
            class={imageClass}
            onClick={() => props.onOpen(props.attachment)}
          />
        </Show>
        <button
          type="button"
          class={`${removeClass} group/remove`}
          onClick={() => props.onRemove(props.attachment.id)}
          aria-label={props.removeLabel}
        >
          <span class={removeIconClass}>
            <Icon name="close-small" size="small" class="text-text-weak group-hover/remove:text-text-strong" />
          </span>
        </button>
      </div>
    </Tooltip>
  )
}
