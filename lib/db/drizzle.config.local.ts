import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve relative to the workspace root (two directories above lib/db/)
const workspaceRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/**
 * Drizzle config for local SQLite development.
 *
 * Use this when DATABASE_URL is not set (i.e. running locally without PostgreSQL).
 * SQLITE_PATH env var sets the database file; defaults to local.db in the workspace root.
 *
 * Push the SQLite schema (creates/updates table structure):
 *   pnpm --filter @workspace/db db:push:local
 *
 * Generate migration SQL files instead:
 *   pnpm --filter @workspace/db db:generate:local
 */
export default defineConfig({
  schema: "./src/schema/tickets-sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_PATH
      ? resolve(process.env.SQLITE_PATH)
      : resolve(workspaceRoot, "local.db"),
  },
});
