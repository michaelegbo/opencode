import path from "path"
import { lookup } from "mime-types"

const ROOT = '/mock'

// TODO:
//
// * Some places use the `glob` utility to scan the filesystem which
//   does not go through `Filesystem`. We should mock that too

function globToRegex(pattern: string, cwd: string): RegExp {
  const full = pattern.startsWith("/") ? pattern : cwd.replace(/\/$/, "") + "/" + pattern
  const escaped = full
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\?/g, "[^/]")
  return new RegExp("^" + escaped + "$")
}

function enoent(p: string) {
  return Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" })
}

/**
 * In-memory virtual filesystem that implements the same API as the
 * real `Filesystem` namespace from `util/filesystem`.
 */
export namespace Filesystem {
  const files = new Map<string, string>()

  // seed
  // for (const [p, content] of Object.entries(SEED)) {
  //   files.set(p, content)
  // }

  function abs(p: string) {
    if (!path.isAbsolute(p)) return path.join(ROOT, p)
    return p
  }

  function pfx(p: string) {
    const resolved = abs(p)
    return resolved.endsWith("/") ? resolved : resolved + "/"
  }

  // -- Filesystem API --

  export async function exists(p: string) {
    const resolved = abs(p)
    if (files.has(resolved)) return true
    const pre = pfx(p)
    for (const key of files.keys()) {
      if (key.startsWith(pre)) return true
    }
    return false
  }

  export async function isDir(p: string) {
    const resolved = abs(p)
    if (files.has(resolved)) return false
    const pre = pfx(p)
    for (const key of files.keys()) {
      if (key.startsWith(pre)) return true
    }
    return false
  }

  export function stat(p: string) {
    const resolved = abs(p)
    const content = files.get(resolved)
    if (content !== undefined) {
      const sz = new TextEncoder().encode(content).byteLength
      return {
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size: sz,
        mtimeMs: Date.now(),
        mtime: new Date(),
      }
    }
    // check directory
    const pre = pfx(p)
    for (const key of files.keys()) {
      if (key.startsWith(pre)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false,
          size: 0,
          mtimeMs: Date.now(),
          mtime: new Date(),
        }
      }
    }
    return undefined
  }

  export async function size(p: string) {
    const content = files.get(abs(p))
    if (content === undefined) return 0
    return new TextEncoder().encode(content).byteLength
  }

  export async function readText(p: string) {
    console.log('reading', p)
    const content = files.get(abs(p))
    if (content === undefined) throw enoent(p)
    return content
  }

  export async function readJson<T = any>(p: string): Promise<T> {
    console.log('reading', p)
    const content = files.get(abs(p))
    if (content === undefined) throw enoent(p)
    return JSON.parse(content)
  }

  export async function readBytes(p: string) {
    console.log('reading', p)
    const content = files.get(abs(p))
    if (content === undefined) throw enoent(p)
    return Buffer.from(content)
  }

  export async function readArrayBuffer(p: string) {
    const content = files.get(abs(p))
    if (content === undefined) throw enoent(p)
    const buf = Buffer.from(content)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  }

  export async function write(p: string, content: string | Buffer | Uint8Array, _mode?: number) {
    console.log('writing', p)
    files.set(abs(p), typeof content === "string" ? content : Buffer.from(content).toString("utf-8"))
  }

  export async function writeJson(p: string, data: unknown, _mode?: number) {
    files.set(abs(p), JSON.stringify(data, null, 2))
  }

  export async function writeStream(p: string, stream: ReadableStream<Uint8Array>, _mode?: number) {
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    files.set(abs(p), Buffer.concat(chunks).toString("utf-8"))
  }

  export function mimeType(p: string) {
    return lookup(p) || "application/octet-stream"
  }

  export function normalizePath(p: string) {
    return p
  }

  export function resolve(p: string) {
    return path.resolve(p)
  }

  export function windowsPath(p: string) {
    return p
  }

  export function overlaps(a: string, b: string) {
    const relA = path.relative(a, b)
    const relB = path.relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  export function contains(parent: string, child: string) {
    return !path.relative(parent, child).startsWith("..")
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result: string[] = []
    while (true) {
      const search = path.join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    let current = options.start
    while (true) {
      for (const target of options.targets) {
        const search = path.join(current, target)
        if (await exists(search)) yield search
      }
      if (options.stop === current) break
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result: string[] = []
    while (true) {
      const dir = abs(current)
      const regex = globToRegex(pattern, dir)
      for (const key of files.keys()) {
        if (regex.test(key)) result.push(key)
      }
      if (stop === current) break
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  // -- extra helpers for direct test manipulation --

  export function _set(p: string, content: string) {
    files.set(abs(p), content)
  }

  export function _get(p: string) {
    return files.get(abs(p))
  }

  export function _remove(p: string) {
    files.delete(abs(p))
  }

  export function _list() {
    return [...files.keys()].sort()
  }
}
