#!/usr/bin/env node
/**
 * seed-local.mjs
 *
 * Loads seeds/tickets.json into the local SQLite database.
 * Safe to run multiple times — skips insert if tickets already exist.
 *
 * Usage:
 *   node seeds/seed-local.mjs
 *
 * Or via npm script (added automatically by start.sh / start.bat on first run).
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");

const dbPath = process.env.SQLITE_PATH
  ? resolve(process.env.SQLITE_PATH)
  : resolve(workspaceRoot, "local.db");

const ticketsJson = resolve(__dirname, "tickets.json");
const tickets = JSON.parse(readFileSync(ticketsJson, "utf8"));

const db = new Database(dbPath);

// Check if any rows already exist — avoid double-seeding
const { count } = db.prepare("SELECT COUNT(*) as count FROM tickets").get();
if (count > 0) {
  console.log(`  Seed skipped: ${count} ticket(s) already in local.db`);
  db.close();
  process.exit(0);
}

const insert = db.prepare(`
  INSERT INTO tickets (
    id, title, description, state, submitter, category, status,
    pending_date, completed_at, submitted_at, priority
  ) VALUES (
    @id, @title, @description, @state, @submitter, @category, @status,
    @pending_date, @completed_at, @submitted_at, @priority
  )
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    insert.run({
      id:           row.id,
      title:        row.title,
      description:  row.description ?? null,
      state:        row.state,
      submitter:    row.submitter ?? null,
      category:     row.category ?? null,
      status:       row.status ?? "todo",
      pending_date: row.pending_date ?? null,
      completed_at: row.completed_at ?? null,
      submitted_at: row.submitted_at ?? null,
      priority:     row.priority ?? "medium",
    });
  }
});

insertMany(tickets);
console.log(`  Seeded ${tickets.length} ticket(s) into ${dbPath}`);
db.close();
