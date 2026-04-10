import type { FollowupDraft } from "@/components/prompt-input/submit"

export type FollowupItem = FollowupDraft & { id: string }

export const removeFollowup = (items: FollowupItem[] | undefined, id: string) =>
  (items ?? []).filter((item) => item.id !== id)

export const moveFollowup = (items: FollowupItem[] | undefined, from: string, to: string) => {
  const list = items ?? []
  const a = list.findIndex((item) => item.id === from)
  const b = list.findIndex((item) => item.id === to)
  if (a === -1 || b === -1 || a === b) return list

  const next = list.slice()
  const [item] = next.splice(a, 1)
  next.splice(b, 0, item)
  return next
}
