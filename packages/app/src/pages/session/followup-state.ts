import type { FollowupDraft } from "@/components/prompt-input/submit"

export type FollowupItem = FollowupDraft & { id: string }

export const removeFollowup = (items: FollowupItem[] | undefined, id: string) =>
  (items ?? []).filter((item) => item.id !== id)
