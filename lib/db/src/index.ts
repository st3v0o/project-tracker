import * as pgSchemaModule from "./schema/index.js";
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
export function searchLike(column: any, value: string) {
  return IS_SQLITE ? like(column, value) : ilike(column, value);
}

let _db: any;
let _ticketsTable: any;
let _pool: any = null;

if (IS_SQLITE) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { ticketsTableSqlite } = await import("./schema/tickets-sqlite.js");

  const dbPath = process.env.SQLITE_PATH ?? "local.db";
  const sqlite = new Database(dbPath);

  // Auto-create the tickets table if it doesn't exist
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

  _db = drizzle(sqlite, { schema: { ticketsTable: ticketsTableSqlite } });
  _ticketsTable = ticketsTableSqlite;
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
export const ticketsTable = _ticketsTable as typeof pgSchemaModule.ticketsTable;

export type { InsertTicket, Ticket } from "./schema/tickets.js";
export { insertTicketSchema } from "./schema/tickets.js";
