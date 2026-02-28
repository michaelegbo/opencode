import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"

export const AccountTable = sqliteTable("account", {
  id: text().primaryKey(),
  email: text().notNull(),
  url: text().notNull(),
  access_token: text().notNull(),
  refresh_token: text().notNull(),
  token_expiry: integer(),
  active: integer({ mode: "boolean" })
    .notNull()
    .$default(() => false),
  ...Timestamps,
})
