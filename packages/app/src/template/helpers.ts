/**
 * Template helpers
 *
 * Pure functions for working with UI template data fetched from the Paddie API.
 * These replace the now-deprecated library.ts exports.
 */

export type TemplateFile = {
  path: string
  content: string
  encoding?: "utf-8" | "base64"
}

export type TemplateAsset = {
  path: string
  url: string
  size: number
  mime?: string
}

export type TemplatePart = {
  id: string
  name: string
  description: string
  selectors: string[]
  files: string[]
  hint?: string
}

/** Shown in the template gallery when `thumb_url` is missing. */
export const DEFAULT_TEMPLATE_THUMB_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#14151d"/>
          <stop offset="100%" style="stop-color:#1f2129"/>
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#g)"/>
      <text x="320" y="188" text-anchor="middle" fill="#8b92a8" font-family="system-ui,sans-serif" font-size="20">Template preview</text>
      <text x="320" y="218" text-anchor="middle" fill="#5c6378" font-family="system-ui,sans-serif" font-size="14">Open to view full canvas</text>
    </svg>`,
  )

export type UITemplateMeta = {
  id: string
  name: string
  description: string
  stack: string
  tier: string
  thumb_url?: string | null
  tags?: string[]
  parts_count: number
  parts_summary: string[]
  is_active: boolean
  display_order: number
}

export type UITemplate = {
  id: string
  name: string
  description: string
  stack: string
  tier: string
  thumb_url?: string | null
  preview: string
  files: TemplateFile[]
  assets: TemplateAsset[]
  parts: TemplatePart[]
  tags?: string[]
  is_active: boolean
  display_order: number
}

export const part = (tpl: UITemplate, id?: string) => tpl.parts.find((item) => item.id === (id || "full"))

export const filesFor = (tpl: UITemplate, item?: TemplatePart) => {
  const pick = new Set((item?.files.length ? item.files : tpl.files.map((file) => file.path)).map((path) => path))
  return tpl.files.filter((file) => pick.has(file.path))
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "paddie-site"

export const materialize = (tpl: UITemplate, name: string) => {
  const id = slugify(name)
  return tpl.files.map((file) => ({
    path: file.path,
    content:
      file.encoding === "base64"
        ? file.content
        : file.content.replaceAll("__PADDIE_TEMPLATE_NAME__", name).replaceAll("__PADDIE_TEMPLATE_SLUG__", id),
    encoding: file.encoding,
  }))
}
