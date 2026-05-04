import { Router, type IRouter } from "express";
import { db, ticketsTable } from "@workspace/db";

const router: IRouter = Router();

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

router.post("/tickets/import-csv", async (req, res) => {
  try {
    const { csv } = req.body as { csv?: string };
    if (!csv || typeof csv !== "string") {
      res.status(400).json({ error: "csv field (string) is required in the request body" });
      return;
    }

    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      res.status(400).json({ error: "CSV must have a header row and at least one data row" });
      return;
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

    const idx = (name: string) => headers.indexOf(name);

    const rows = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);
      const get = (col: string) => fields[idx(col)]?.trim() ?? "";

      const title = get("title");
      const submitter = get("submitter");
      const state = get("state");
      const category = get("category");

      if (!title || !submitter || !state || !category) {
        errors.push(`Row ${i + 1}: missing required field (title, submitter, state, or category)`);
        continue;
      }

      const rawSubmittedAt = get("submitted_at") || get("submittedat");
      const rawCompletedAt = get("completed_at") || get("completedat");

      const submittedAt = rawSubmittedAt ? new Date(rawSubmittedAt) : new Date();
      const completedAt = rawCompletedAt ? new Date(rawCompletedAt) : null;

      const status = get("status") || "todo";
      const priority = get("priority") || "medium";
      const description = get("description") || "";
      const pendingDate = get("pending_date") || get("pendingdate") || null;

      rows.push({
        title,
        submitter,
        state,
        category,
        description,
        status,
        priority,
        submittedAt,
        completedAt: completedAt as any,
        pendingDate: pendingDate as any,
      });
    }

    if (rows.length === 0) {
      res.status(400).json({ error: "No valid rows to import", details: errors });
      return;
    }

    const inserted = await db.insert(ticketsTable).values(rows as any).returning();

    res.status(201).json({
      imported: inserted.length,
      skipped: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to import CSV");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
