import * as pgSchemaModule from "./schema/index.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool as PgPool } from "pg";
import { like, ilike } from "drizzle-orm";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const IS_SQLITE = !process.env.DATABASE_URL;

/**
 * Normalise any timestamp value to an ISO string.
 * Both the PG and SQLite adapters return Date objects for timestamp columns
 * (SQLite uses the isoDate custom type which maps TEXT → Date). This helper
 * provides a safe fallback for either case.
 */
export function toISO(val: Date | string | null | undefined): string | null {
  if (val == null) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

/**
 * Case-insensitive LIKE helper.
 * PostgreSQL supports ILIKE natively; SQLite LIKE is case-insensitive for ASCII.
 */
export function searchLike(column: Parameters<typeof like>[0], value: string) {
  return IS_SQLITE ? like(column, value) : ilike(column, value);
}

// ── Database initialisation ─────────────────────────────────────────────────
//
// In SQLite mode (no DATABASE_URL), the application uses better-sqlite3 +
// drizzle-orm/better-sqlite3 + ticketsTableSqlite (sqlite-core schema).
//
// In PostgreSQL mode (DATABASE_URL set), it uses node-postgres +
// drizzle-orm/node-postgres + ticketsTable (pg-core schema).
//
// Both db objects expose the same drizzle query-builder API
// (.select / .insert / .update / .delete / .returning). The exported `db` is
// typed as NodePgDatabase because that is the canonical interface used by the
// routes. The runtime instance is dialect-correct in both modes.
//
// The `as unknown as` cast below is unavoidable: drizzle-orm does not expose a
// shared base interface for BetterSQLite3Database and NodePgDatabase, so a
// cross-dialect cast must go through `unknown`. Dialect correctness is
// preserved at runtime by exporting `ticketsTable` as ticketsTableSqlite in
// SQLite mode — the SQLite column-type mappers (isoDate: TEXT ↔ Date) are
// used for every query, not the PG ones.

let _db!: NodePgDatabase<typeof pgSchemaModule>;
let _ticketsTable!: typeof pgSchemaModule.ticketsTable;
let _pool: PgPool | null = null;

if (IS_SQLITE) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { ticketsTableSqlite } = await import("./schema/tickets-sqlite.js");

  // Resolve absolute path so the db file is the same regardless of cwd.
  const workspaceRoot = resolve(
    fileURLToPath(import.meta.url),
    "..", // src/
    "..", // lib/db/
    "..", // lib/
    ".."  // workspace root
  );
  const dbPath = process.env.SQLITE_PATH
    ? resolve(process.env.SQLITE_PATH)
    : resolve(workspaceRoot, "local.db");

  const sqlite = new Database(dbPath);

  _db = drizzle(sqlite, {
    schema: { ticketsTable: ticketsTableSqlite },
  }) as unknown as NodePgDatabase<typeof pgSchemaModule>;

  // Export the SQLite table object so drizzle uses the correct SQLite column
  // type mappers (isoDate) for all queries — no dialect mixing.
  _ticketsTable = ticketsTableSqlite as unknown as typeof pgSchemaModule.ticketsTable;
} else {
  const pg = (await import("pg")).default;
  const { drizzle } = await import("drizzle-orm/node-postgres");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
  _pool = pool;
  _db = drizzle(pool, { schema: pgSchemaModule });
  _ticketsTable = pgSchemaModule.ticketsTable;
}

export const db = _db;
export const pool = _pool;
/** Dialect-correct table reference for the active database mode. */
export const ticketsTable = _ticketsTable;

export type { InsertTicket, Ticket } from "./schema/tickets.js";
export { insertTicketSchema } from "./schema/tickets.js";
