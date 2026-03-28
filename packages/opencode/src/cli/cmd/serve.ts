import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"
import { Workspace } from "../../control-plane/workspace"
import { Project } from "../../project/project"
import { Installation } from "../../installation"
import { PushRelay } from "../../server/push-relay"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .option("relay-url", {
        type: "string",
        describe: "experimental APN relay URL",
      })
      .option("relay-secret", {
        type: "string",
        describe: "experimental APN relay secret",
      }),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)

    const relayURL = (
      args["relay-url"] ??
      process.env.OPENCODE_EXPERIMENTAL_PUSH_RELAY_URL ??
      "https://relay.opencode.ai"
    ).trim()
    const relaySecret = (args["relay-secret"] ?? process.env.OPENCODE_EXPERIMENTAL_PUSH_RELAY_SECRET ?? "").trim()
    if (relayURL && relaySecret) {
      const host = server.hostname ?? opts.hostname
      const port = server.port || opts.port || 4096
      const pair = PushRelay.start({
        relayURL,
        relaySecret,
        hostname: host,
        port,
      })
      if (pair) {
        console.log("experimental push relay enabled")
        console.log("qr payload")
        console.log(JSON.stringify(pair, null, 2))
      }
    }

    await new Promise(() => {})
    await server.stop()
  },
})
