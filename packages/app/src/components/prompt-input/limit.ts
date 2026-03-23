const MB = 1024 * 1024

export const MAX_ATTACHMENT_BYTES = 5 * MB

export function estimateAttachment(file: { size: number }, mime: string) {
  return `data:${mime};base64,`.length + Math.ceil(file.size / 3) * 4
}

export function totalAttachments(list: Array<{ dataUrl: string }>) {
  return list.reduce((sum, part) => sum + part.dataUrl.length, 0)
}

export function wouldExceedAttachmentLimit(list: Array<{ dataUrl: string }>, file: { size: number }, mime: string) {
  return totalAttachments(list) + estimateAttachment(file, mime) > MAX_ATTACHMENT_BYTES
}
