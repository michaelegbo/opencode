import type { BunPlugin } from "bun"
import { Filesystem } from "./vfs"

/**
 * Bun plugin that intercepts all loads of `util/filesystem.ts` and replaces
 * the real Filesystem namespace with the in-memory VFS implementation.
 *
 * Must be registered via preload before any application code runs.
 */
export const vfsPlugin: BunPlugin = {
  name: "vfs",
  setup(build) {
    build.onLoad({ filter: /util\/filesystem\.ts$/ }, () => ({
      exports: { Filesystem },
      loader: "object",
    }))
  },
}
