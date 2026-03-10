import semver from "semver"
import z from "zod"
import { NamedError } from "@opencode-ai/util/error"
import { Global } from "../global"
import { Lock } from "../util/lock"
import { Log } from "../util/log"
import path from "path"
import { readdir } from "fs/promises"
import { Arborist } from "@npmcli/arborist"

export namespace Npm {
  const log = Log.create({ service: "npm" })

  export const InstallFailedError = NamedError.create(
    "NpmInstallFailedError",
    z.object({
      pkg: z.string(),
    }),
  )

  function directory(pkg: string) {
    return path.join(Global.Path.cache, "packages", pkg)
  }

  export async function outdated(pkg: string, cachedVersion: string): Promise<boolean> {
    const response = await fetch(`https://registry.npmjs.org/${pkg}`)
    if (!response.ok) {
      log.warn("Failed to resolve latest version, using cached", { pkg, cachedVersion })
      return false
    }

    const data = (await response.json()) as { "dist-tags"?: { latest?: string } }
    const latestVersion = data?.["dist-tags"]?.latest
    if (!latestVersion) {
      log.warn("No latest version found, using cached", { pkg, cachedVersion })
      return false
    }

    const isRange = /[\s^~*xX<>|=]/.test(cachedVersion)
    if (isRange) return !semver.satisfies(latestVersion, cachedVersion)

    return semver.lt(cachedVersion, latestVersion)
  }

  export async function add(pkg: string) {
    using _ = await Lock.write("npm-install")
    log.info("installing package using npm arborist", {
      pkg,
    })
    const hash = pkg
    const dir = directory(hash)

    const arborist = new Arborist({
      path: dir,
      binLinks: true,
      progress: false,
      savePrefix: "",
    })
    const tree = await arborist.loadVirtual().catch(() => {})
    if (tree) {
      const first = tree.edgesOut.values().next().value?.to
      if (first) return first.path
    }

    const result = await arborist
      .reify({
        add: [pkg],
        save: true,
        saveType: "prod",
      })
      .catch((cause) => {
        throw new InstallFailedError(
          { pkg },
          {
            cause,
          },
        )
      })

    const first = result.edgesOut.values().next().value?.to
    if (!first) throw new InstallFailedError({ pkg })
    return first.path
  }

  export async function install(dir: string) {
    log.info("installing dependencies", { dir })
    const arb = new Arborist({
      path: dir,
      binLinks: true,
      progress: false,
      savePrefix: "",
    })
    const result = await arb.reify()
    console.log(result)
  }

  export async function which(pkg: string) {
    const dir = path.join(directory(pkg), "node_modules", ".bin")
    const files = await readdir(dir).catch(() => [])
    if (!files.length) {
      await add(pkg)
      return which(pkg)
    }
    return path.join(dir, files[0])
  }
}
