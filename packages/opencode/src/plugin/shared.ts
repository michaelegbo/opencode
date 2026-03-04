import { BunProc } from "@/bun"

export function parsePluginSpecifier(spec: string) {
  const at = spec.lastIndexOf("@")
  const pkg = at > 0 ? spec.substring(0, at) : spec
  const version = at > 0 ? spec.substring(at + 1) : "latest"
  return { pkg, version }
}

export async function resolvePluginTarget(spec: string, parsed = parsePluginSpecifier(spec)) {
  if (spec.startsWith("file://")) return spec
  return BunProc.install(parsed.pkg, parsed.version)
}

export function uniqueModuleEntries(mod: Record<string, unknown>) {
  const seen = new Set<unknown>()
  const entries: [string, unknown][] = []

  for (const [name, entry] of Object.entries(mod)) {
    if (seen.has(entry)) continue
    seen.add(entry)
    entries.push([name, entry])
  }

  return entries
}
