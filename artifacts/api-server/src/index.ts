import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app";
import { logger } from "./lib/logger";
import { IS_SQLITE } from "@workspace/db";

const port = Number(process.env.PORT ?? "8080");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

// When running locally (no DATABASE_URL), push the SQLite schema to local.db
// before accepting requests. This handles both first-run table creation and
// schema changes made after initial setup.
if (IS_SQLITE) {
  const workspaceRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    // from dist/ → api-server/ → artifacts/ → workspace root
    "..",
    "..",
    ".."
  );

  logger.info("SQLite mode: pushing schema to local.db...");
  try {
    execSync(
      "pnpm --filter @workspace/db db:push:local --accept-warnings",
      {
        cwd: workspaceRoot,
        stdio: "pipe",
        env: {
          ...process.env,
          SQLITE_PATH: process.env.SQLITE_PATH ?? "local.db",
        },
      }
    );
    logger.info("SQLite schema up to date");
  } catch (err) {
    // Log but do not crash — the table was already created if this is a re-run
    logger.warn({ err }, "drizzle-kit push failed (schema may already be current)");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
