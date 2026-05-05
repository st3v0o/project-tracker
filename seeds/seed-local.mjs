#!/usr/bin/env node
/**
 * seed-local.mjs
 *
 * Loads seeds/tickets.json into the running local API server via
 * POST /api/tickets/import-csv.  No native modules required — uses
 * built-in fetch (Node 18+) and the same import endpoint the UI uses.
 *
 * Safe to run multiple times: skips if any tickets already exist.
 *
 * Usage:
 *   node seeds/seed-local.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tickets = JSON.parse(
  readFileSync(resolve(__dirname, "tickets.json"), "utf8")
);

const API_PORT = process.env.API_PORT ?? "8080";
const BASE = `http://localhost:${API_PORT}`;

// Check if any tickets already exist
let existing = 0;
try {
  const r = await fetch(`${BASE}/api/tickets`);
  if (r.ok) {
    const data = await r.json();
    existing = Array.isArray(data) ? data.length : 0;
  }
} catch {
  console.log("  Seed skipped: API not reachable");
  process.exit(0);
}

if (existing > 0) {
  console.log(`  Seed skipped: ${existing} ticket(s) already exist`);
  process.exit(0);
}

// Build CSV from the JSON seed data
const HEADERS = [
  "title", "description", "state", "submitter", "category",
  "status", "priority", "submitted_at", "completed_at",
];

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const rows = [HEADERS.join(",")];
for (const t of tickets) {
  rows.push([
    t.title,
    t.description ?? "",
    t.state,
    t.submitter ?? "",
    t.category ?? "",
    t.status ?? "todo",
    t.priority ?? "medium",
    t.submitted_at ?? "",
    t.completed_at ?? "",
  ].map(csvEscape).join(","));
}

const csv = rows.join("\n");

// POST to the bulk import endpoint
const res = await fetch(`${BASE}/api/tickets/import-csv`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ csv }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`  [ERROR] Seed failed (HTTP ${res.status}): ${body}`);
  process.exit(1);
}

const result = await res.json();
console.log(`  Seeded ${result.imported} ticket(s) into local database`);
if (result.errors?.length) {
  console.warn(`  Warnings: ${result.errors.join("; ")}`);
}
