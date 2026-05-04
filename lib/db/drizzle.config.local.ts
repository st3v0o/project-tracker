import { defineConfig } from "drizzle-kit";

/**
 * Drizzle config for local SQLite development.
 *
 * Use this when DATABASE_URL is not set (i.e. running locally without PostgreSQL).
 *
 * To push the SQLite schema without generating migration files:
 *   pnpm --filter @workspace/db db:push:local
 *
 * To generate migration SQL files instead:
 *   pnpm --filter @workspace/db db:generate:local
 */
export default defineConfig({
  schema: "./src/schema/tickets-sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? "../../local.db",
  },
});
