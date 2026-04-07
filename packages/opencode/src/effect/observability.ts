import { Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { Otlp } from "effect/unstable/observability"
import { Flag } from "@/flag/flag"
import { CHANNEL, VERSION } from "@/installation/meta"

export namespace Observability {
  const base = Flag.OPENCODE_OTLP_BASE_URL?.trim() || undefined

  export const enabled = !!base

  export const layer = !base
    ? Layer.empty
    : Otlp.layerJson({
        baseUrl: base,
        loggerMergeWithExisting: false,
        resource: {
          serviceName: "opencode",
          serviceVersion: VERSION,
          attributes: {
            "deployment.environment.name": CHANNEL === "local" ? "local" : CHANNEL,
            "opencode.client": Flag.OPENCODE_CLIENT,
          },
        },
      }).pipe(Layer.provide(FetchHttpClient.layer))
}
