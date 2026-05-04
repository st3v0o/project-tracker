import * as pgSchemaModule from "./schema/index.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool as PgPool } from "pg";
import { like, ilike } from "drizzle-orm";

export const IS_SQLITE = !process.env.DATABASE_URL;

/**
 * Normalise any timestamp value to an ISO string.
 * PostgreSQL returns Date objects; SQLite returns strings.
 */
export function toISO(val: Date | string | null | undefined): string | null {
  if (val == null) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

/**
 * Case-insensitive LIKE helper.
 * PostgreSQL supports ILIKE; SQLite's LIKE is already case-insensitive for ASCII.
 */
export function searchLike(column: Parameters<typeof like>[0], value: string) {
  return IS_SQLITE ? like(column, value) : ilike(column, value);
}

// `_db` will be assigned in exactly one branch below; the definite-assignment
// assertion (!) lets TypeScript trust that without requiring `any`.
let _db!: NodePgDatabase<typeof pgSchemaModule>;
let _pool: PgPool | null = null;

if (IS_SQLITE) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { ticketsTableSqlite } = await import("./schema/tickets-sqlite.js");

  const dbPath = process.env.SQLITE_PATH ?? "local.db";
  const sqlite = new Database(dbPath);

  // Auto-create the tickets table if it doesn't exist.
  // Run `pnpm --filter @workspace/db db:push:local` after schema changes.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL,
      submitter TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      pending_date TEXT,
      completed_at TEXT,
      submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    )
  `);

  // Cast to the canonical PG database type — both Drizzle adapters expose the
  // same query-builder API (.select / .insert / .update / .delete / .returning).
  // The only runtime difference (Date vs string for timestamps) is handled by toISO().
  _db = drizzle(sqlite, {
    schema: { ticketsTable: ticketsTableSqlite },
  }) as unknown as NodePgDatabase<typeof pgSchemaModule>;
} else {
  const pg = (await import("pg")).default;
  const { drizzle } = await import("drizzle-orm/node-postgres");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
  _pool = pool;
  _db = drizzle(pool, { schema: pgSchemaModule });
}

export const db = _db;
export const pool = _pool;
/** Canonical table reference — use this everywhere for queries. */
export const ticketsTable = pgSchemaModule.ticketsTable;

export type { InsertTicket, Ticket } from "./schema/tickets.js";
export { insertTicketSchema } from "./schema/tickets.js";
