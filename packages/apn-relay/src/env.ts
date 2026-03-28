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

export const env = schema.parse(process.env)
