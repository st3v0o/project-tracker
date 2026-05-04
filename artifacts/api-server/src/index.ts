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

// In local SQLite mode (DATABASE_URL not set), push the schema to local.db
// before accepting any requests. This runs drizzle-kit push which handles both
// first-run table creation and schema changes made after the initial setup.
// The server exits with a non-zero code if the push fails.
if (IS_SQLITE) {
  // Compute absolute paths so drizzle-kit and the runtime db always use the
  // same file, regardless of the working directory this process was launched from.
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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
