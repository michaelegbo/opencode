import { z } from "zod"

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_HOST: z.string().min(1),
  DATABASE_USERNAME: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  APNS_TEAM_ID: z.string().min(1),
  APNS_KEY_ID: z.string().min(1),
  APNS_PRIVATE_KEY: z.string().min(1),
  APNS_DEFAULT_BUNDLE_ID: z.string().min(1),
})

const req = [
  "DATABASE_HOST",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "APNS_TEAM_ID",
  "APNS_KEY_ID",
  "APNS_PRIVATE_KEY",
  "APNS_DEFAULT_BUNDLE_ID",
] as const

const out = schema.safeParse(process.env)

if (!out.success) {
  const miss = req.filter((key) => !process.env[key]?.trim())
  const bad = out.error.issues
    .map((item) => item.path[0])
    .filter((key): key is string => typeof key === "string")
    .filter((key) => !miss.includes(key as (typeof req)[number]))

  console.error("[apn-relay] Invalid startup configuration")
  if (miss.length) console.error(`[apn-relay] Missing required env vars: ${miss.join(", ")}`)
  if (bad.length) console.error(`[apn-relay] Invalid env vars: ${Array.from(new Set(bad)).join(", ")}`)
  console.error("[apn-relay] Check .env.example and restart")

  throw new Error("Startup configuration invalid")
}

export const env = out.data
