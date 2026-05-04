import * as pgSchemaModule from "./schema/index.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool as PgPool } from "pg";
import { like, ilike } from "drizzle-orm";

export const IS_SQLITE = !process.env.DATABASE_URL;

/**
 * Normalise any timestamp value to an ISO string.
 * PostgreSQL driver returns Date objects; SQLite isoDate custom type also
 * returns Date objects, so this is a safety fallback for both modes.
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
// In SQLite mode (no DATABASE_URL), the application uses better-sqlite3 with
// drizzle-orm/better-sqlite3 and ticketsTableSqlite (defined in sqlite-core).
//
// In PostgreSQL mode (DATABASE_URL set), it uses the node-postgres driver with
// drizzle-orm/node-postgres and the canonical ticketsTable (defined in pg-core).
//
// Both database objects expose the same drizzle query-builder API
// (.select / .insert / .update / .delete / .returning). The exported `db` is
// typed as NodePgDatabase because that is the canonical interface consumed by
// the routes; the runtime instance is dialect-correct in both modes.
//
// The `as unknown as` cast below is unavoidable: drizzle-orm does not expose a
// shared base interface for its SQLite and PG database classes, so a cross-
// dialect cast requires the double-hop through `unknown`. The dialect mismatch
// is prevented at runtime by exporting `ticketsTable` as the SQLite table
// object (ticketsTableSqlite) in SQLite mode, ensuring the correct column-type
// mappers are used for every query.

let _db!: NodePgDatabase<typeof pgSchemaModule>;
let _ticketsTable!: typeof pgSchemaModule.ticketsTable;
let _pool: PgPool | null = null;

if (IS_SQLITE) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { ticketsTableSqlite } = await import("./schema/tickets-sqlite.js");

  const dbPath = process.env.SQLITE_PATH ?? "local.db";
  const sqlite = new Database(dbPath);

  _db = drizzle(sqlite, {
    schema: { ticketsTable: ticketsTableSqlite },
  }) as unknown as NodePgDatabase<typeof pgSchemaModule>;

  // At runtime in SQLite mode we use ticketsTableSqlite so that drizzle uses
  // the correct SQLite column-type mappers (e.g. isoDate → Date).  The cast to
  // the PG table type is safe because both tables have identical SQL columns
  // and both expose `Date | null` for timestamp fields.
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
