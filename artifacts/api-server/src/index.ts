import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app";
import { logger } from "./lib/logger";
import { IS_SQLITE } from "@workspace/db";

const port = Number(process.env.PORT ?? "8080");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

// In local SQLite mode (DATABASE_URL not set), ensure the schema exists before
// accepting any requests.
if (IS_SQLITE) {
  const workspaceRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    // dist/ → api-server/ → artifacts/ → workspace root
    "..",
    "..",
    ".."
  );
  const sqlitePath = process.env.SQLITE_PATH
    ? resolve(process.env.SQLITE_PATH)
    : resolve(workspaceRoot, "local.db");

  if (process.env.ELECTRON_PACKAGED === "1") {
    // ── Packaged Electron app ──────────────────────────────────────────────
    // pnpm / drizzle-kit are not available in the installed app.
    // Bootstrap the schema directly via better-sqlite3 using
    // CREATE TABLE IF NOT EXISTS — safe to run on every startup.
    logger.info({ sqlitePath }, "SQLite mode (packaged): ensuring schema...");
    try {
      const _require = createRequire(import.meta.url);
      const Database = _require("better-sqlite3");
      const _sqlite = new Database(sqlitePath);
      _sqlite.exec(`
        CREATE TABLE IF NOT EXISTS tickets (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          title        TEXT NOT NULL,
          description  TEXT NOT NULL DEFAULT '',
          state        TEXT NOT NULL,
          submitter    TEXT NOT NULL,
          category     TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'todo',
          priority     TEXT NOT NULL DEFAULT 'medium',
          pending_date TEXT,
          completed_at TEXT,
          submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )
      `);
      _sqlite.close();
      logger.info("SQLite schema is up to date");
    } catch (err) {
      logger.error({ err }, "SQLite schema setup failed — cannot start server");
      process.exit(1);
    }
  } else {
    // ── Dev / start.bat mode ───────────────────────────────────────────────
    // Use drizzle-kit push so schema migrations are applied automatically.
    logger.info({ sqlitePath }, "SQLite mode: syncing schema...");
    try {
      execSync("pnpm --filter @workspace/db db:push:local", {
        cwd: workspaceRoot,
        stdio: "pipe",
        env: {
          ...process.env,
          SQLITE_PATH: sqlitePath,
        },
      });
      logger.info("SQLite schema is up to date");
    } catch (err) {
      logger.error({ err }, "SQLite schema push failed — cannot start server");
      process.exit(1);
    }
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
