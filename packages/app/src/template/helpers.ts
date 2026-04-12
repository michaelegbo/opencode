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
