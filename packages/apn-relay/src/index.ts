import { randomUUID } from "node:crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { send } from "./apns"
import { db } from "./db"
import { env } from "./env"
import { hash } from "./hash"
import { delivery_log, device_registration } from "./schema.sql"
import { setup } from "./setup"

const reg = z.object({
  secret: z.string().min(1),
  deviceToken: z.string().min(1),
  bundleId: z.string().min(1).optional(),
  apnsEnv: z.enum(["sandbox", "production"]).default("production"),
})

const unreg = z.object({
  secret: z.string().min(1),
  deviceToken: z.string().min(1),
})

const evt = z.object({
  secret: z.string().min(1),
  eventType: z.enum(["complete", "permission", "error"]),
  sessionID: z.string().min(1),
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
})

function title(input: z.infer<typeof evt>["eventType"]) {
  if (input === "complete") return "Session complete"
  if (input === "permission") return "Action needed"
  return "Session error"
}

function body(input: z.infer<typeof evt>["eventType"]) {
  if (input === "complete") return "OpenCode finished your session."
  if (input === "permission") return "OpenCode needs your permission decision."
  return "OpenCode reported an error for your session."
}

const app = new Hono()

app.onError((err, c) => {
  return c.json(
    {
      ok: false,
      error: err.message,
    },
    500,
  )
})

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: "Not found",
    },
    404,
  )
})

app.get("/health", async (c) => {
  const [a] = await db.select({ value: sql<number>`count(*)` }).from(device_registration)
  const [b] = await db.select({ value: sql<number>`count(*)` }).from(delivery_log)
  return c.json({
    ok: true,
    devices: Number(a?.value ?? 0),
    deliveries: Number(b?.value ?? 0),
  })
})

app.get("/", async (c) => {
  const [a] = await db.select({ value: sql<number>`count(*)` }).from(device_registration)
  const [b] = await db.select({ value: sql<number>`count(*)` }).from(delivery_log)
  const rows = await db.select().from(delivery_log).orderBy(desc(delivery_log.created_at)).limit(20)

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>APN Relay</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #111827; }
      h1 { margin: 0 0 12px 0; }
      .stats { display: flex; gap: 16px; margin: 0 0 18px 0; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; min-width: 160px; }
      .muted { color: #6b7280; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 12px; }
      th { background: #f9fafb; }
    </style>
  </head>
  <body>
    <h1>APN Relay</h1>
    <p class="muted">MVP dashboard</p>
    <div class="stats">
      <div class="card">
        <div class="muted">Registered devices</div>
        <div>${Number(a?.value ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">Delivery log rows</div>
        <div>${Number(b?.value ?? 0)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>time</th>
          <th>event</th>
          <th>session</th>
          <th>status</th>
          <th>error</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `<tr>
          <td>${new Date(row.created_at).toISOString()}</td>
          <td>${row.event_type}</td>
          <td>${row.session_id}</td>
          <td>${row.status}</td>
          <td>${row.error ?? ""}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </body>
</html>`

  return c.html(html)
})

app.post("/v1/device/register", async (c) => {
  const raw = await c.req.json().catch(() => undefined)
  const check = reg.safeParse(raw)
  if (!check.success) {
    return c.json(
      {
        ok: false,
        error: "Invalid request body",
      },
      400,
    )
  }

  const now = Date.now()
  const key = hash(check.data.secret)
  const row = {
    id: randomUUID(),
    secret_hash: key,
    device_token: check.data.deviceToken,
    bundle_id: check.data.bundleId ?? env.APNS_DEFAULT_BUNDLE_ID,
    apns_env: check.data.apnsEnv,
    created_at: now,
    updated_at: now,
  }

  await db
    .insert(device_registration)
    .values(row)
    .onDuplicateKeyUpdate({
      set: {
        bundle_id: row.bundle_id,
        apns_env: row.apns_env,
        updated_at: now,
      },
    })

  return c.json({ ok: true })
})

app.post("/v1/device/unregister", async (c) => {
  const raw = await c.req.json().catch(() => undefined)
  const check = unreg.safeParse(raw)
  if (!check.success) {
    return c.json(
      {
        ok: false,
        error: "Invalid request body",
      },
      400,
    )
  }

  await db
    .delete(device_registration)
    .where(
      and(
        eq(device_registration.secret_hash, hash(check.data.secret)),
        eq(device_registration.device_token, check.data.deviceToken),
      ),
    )

  return c.json({ ok: true })
})

app.post("/v1/event", async (c) => {
  const raw = await c.req.json().catch(() => undefined)
  const check = evt.safeParse(raw)
  if (!check.success) {
    return c.json(
      {
        ok: false,
        error: "Invalid request body",
      },
      400,
    )
  }

  const key = hash(check.data.secret)
  const list = await db.select().from(device_registration).where(eq(device_registration.secret_hash, key))
  if (!list.length) {
    return c.json({
      ok: true,
      sent: 0,
      failed: 0,
    })
  }

  const out = await Promise.all(
    list.map((row) =>
      send({
        token: row.device_token,
        bundle: row.bundle_id,
        env: row.apns_env === "sandbox" ? "sandbox" : "production",
        title: check.data.title ?? title(check.data.eventType),
        body: check.data.body ?? body(check.data.eventType),
        data: {
          eventType: check.data.eventType,
          sessionID: check.data.sessionID,
        },
      }),
    ),
  )

  const now = Date.now()
  await db.insert(delivery_log).values(
    out.map((item) => ({
      id: randomUUID(),
      secret_hash: key,
      event_type: check.data.eventType,
      session_id: check.data.sessionID,
      status: item.ok ? "sent" : "failed",
      error: item.error,
      created_at: now,
    })),
  )

  const sent = out.filter((item) => item.ok).length
  return c.json({
    ok: true,
    sent,
    failed: out.length - sent,
  })
})

await setup()

if (import.meta.main) {
  Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  })
  console.log(`apn-relay listening on http://0.0.0.0:${env.PORT}`)
}

export default app
