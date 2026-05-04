import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import { db, ticketsTable, toISO, searchLike } from "@workspace/db";
import {
  ListTicketsQueryParams,
  ExportTicketsQueryParams,
  CreateTicketBody,
  UpdateTicketBody,
  GetTicketParams,
  UpdateTicketParams,
  DeleteTicketParams,
} from "@workspace/api-zod";
import { eq, and, or, type SQL, asc, desc, sql } from "drizzle-orm";
import { format } from "date-fns";

const router: IRouter = Router();

// Helper: normalise a ticket row returned from either SQLite or PostgreSQL
function normaliseTicket(t: typeof ticketsTable.$inferSelect) {
  return {
    ...t,
    pendingDate: t.pendingDate ?? null,
    completedAt: toISO(t.completedAt),
    submittedAt: toISO(t.submittedAt)!,
    createdAt: toISO(t.createdAt)!,
    updatedAt: toISO(t.updatedAt)!,
  };
}

router.get("/tickets", async (req, res) => {
  try {
    const parsed = ListTicketsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { state, submitter, status, category, priority } = parsed.data;

    const conditions: SQL[] = [];
    if (state) conditions.push(eq(ticketsTable.state, state));
    if (submitter) conditions.push(eq(ticketsTable.submitter, submitter));
    if (status) conditions.push(eq(ticketsTable.status, status));
    if (category) conditions.push(eq(ticketsTable.category, category));
    if (priority) conditions.push(eq(ticketsTable.priority, priority));

    const rows =
      conditions.length > 0
        ? await db.select().from(ticketsTable).where(and(...conditions))
        : await db.select().from(ticketsTable);

    res.json(rows.map(normaliseTicket));
  } catch (err) {
    req.log.error({ err }, "Failed to list tickets");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tickets/export", async (req, res) => {
  try {
    const parsed = ExportTicketsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { state, submitter, status, category, priority, search: rawSearch, sortBy } = parsed.data;
    const search = rawSearch?.trim() ?? "";

    const conditions: SQL[] = [];
    if (state) conditions.push(eq(ticketsTable.state, state));
    if (submitter) conditions.push(eq(ticketsTable.submitter, submitter));
    if (status) conditions.push(eq(ticketsTable.status, status));
    if (category) conditions.push(eq(ticketsTable.category, category));
    if (priority) conditions.push(eq(ticketsTable.priority, priority));
    if (search) {
      conditions.push(
        or(
          searchLike(ticketsTable.title, `%${search}%`),
          searchLike(ticketsTable.submitter, `%${search}%`)
        ) as SQL
      );
    }

    const orderExpr = (() => {
      switch (sortBy) {
        case "oldest":        return asc(ticketsTable.submittedAt);
        case "title_asc":     return asc(ticketsTable.title);
        case "title_desc":    return desc(ticketsTable.title);
        case "submitter_asc": return asc(ticketsTable.submitter);
        case "state_asc":     return asc(ticketsTable.state);
        case "category_asc":  return asc(ticketsTable.category);
        case "status":
          return sql`CASE status WHEN 'todo' THEN 0 WHEN 'pending' THEN 1 WHEN 'complete' THEN 2 ELSE 3 END ASC`;
        case "priority_high":
          return sql`CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC`;
        case "priority_low":
          return sql`CASE priority WHEN 'low' THEN 0 WHEN 'medium' THEN 1 WHEN 'high' THEN 2 WHEN 'critical' THEN 3 ELSE 4 END ASC`;
        case "newest":
        default:              return desc(ticketsTable.submittedAt);
      }
    })();

    const baseQuery = db.select().from(ticketsTable);
    const tickets = await (
      conditions.length > 0
        ? baseQuery.where(and(...conditions)).orderBy(orderExpr)
        : baseQuery.orderBy(orderExpr)
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Project Tracker";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tickets");

    const COLS: { header: string; key: string; minWidth: number }[] = [
      { header: "ID", key: "id", minWidth: 6 },
      { header: "Title", key: "title", minWidth: 20 },
      { header: "Submitter", key: "submitter", minWidth: 14 },
      { header: "State", key: "state", minWidth: 14 },
      { header: "Category", key: "category", minWidth: 16 },
      { header: "Status", key: "status", minWidth: 10 },
      { header: "Priority", key: "priority", minWidth: 12 },
      { header: "Description", key: "description", minWidth: 30 },
      { header: "Submitted At", key: "submittedAt", minWidth: 18 },
      { header: "Completed At", key: "completedAt", minWidth: 18 },
      { header: "Time Since (days)", key: "timeSinceDays", minWidth: 18 },
    ];

    sheet.columns = COLS.map((c) => ({ header: c.header, key: c.key, width: c.minWidth }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 22;

    const colWidths: number[] = COLS.map((c) => c.header.length);

    const now = new Date();
    for (const t of tickets) {
      const submittedAt = new Date(toISO(t.submittedAt) ?? now);
      const daysSince = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24));
      const completedIso = toISO(t.completedAt);

      const rowValues: Record<string, string | number> = {
        id: t.id,
        title: t.title,
        submitter: t.submitter,
        state: t.state,
        category: t.category,
        status: t.status,
        priority: t.priority,
        description: t.description,
        submittedAt: format(submittedAt, "MM/dd/yyyy HH:mm"),
        completedAt: completedIso ? format(new Date(completedIso), "MM/dd/yyyy HH:mm") : "",
        timeSinceDays: daysSince,
      };

      sheet.addRow(rowValues);

      COLS.forEach((col, i) => {
        const val = String(rowValues[col.key] ?? "");
        const len = col.key === "description" ? Math.min(val.length, 60) : val.length;
        colWidths[i] = Math.max(colWidths[i], len);
      });
    }

    sheet.columns.forEach((col, i) => {
      col.width = Math.max(colWidths[i] + 2, COLS[i].minWidth);
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rowNumber % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F3FF" } };
      }
      row.alignment = { vertical: "middle", wrapText: false };
    });

    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: { row: 1, column: COLS.length } };

    const dateStr = format(now, "yyyy-MM-dd");
    const filename = `tickets-export-${dateStr}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export tickets");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tickets", async (req, res) => {
  try {
    const parsed = CreateTicketBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { title, description, state, submitter, category, status, priority, submittedAt } = parsed.data;

    const [ticket] = await db
      .insert(ticketsTable)
      .values({
        title,
        description: description ?? "",
        state,
        submitter,
        category,
        status: status ?? "todo",
        priority: priority ?? "medium",
        submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
      })
      .returning();

    res.status(201).json(normaliseTicket(ticket));
  } catch (err) {
    req.log.error({ err }, "Failed to create ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tickets/:id", async (req, res) => {
  try {
    const parsed = GetTicketParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ticket ID" });
      return;
    }

    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, parsed.data.id));

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json(normaliseTicket(ticket));
  } catch (err) {
    req.log.error({ err }, "Failed to get ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tickets/:id", async (req, res) => {
  try {
    const paramsParsed = UpdateTicketParams.safeParse({ id: Number(req.params.id) });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid ticket ID" });
      return;
    }

    const bodyParsed = UpdateTicketBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.message });
      return;
    }

    const updateData: Partial<typeof ticketsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    const {
      title, description, state, submitter, category, status, priority,
      pendingDate, completedAt, submittedAt,
    } = bodyParsed.data;

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (state !== undefined) updateData.state = state;
    if (submitter !== undefined) updateData.submitter = submitter;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (pendingDate !== undefined) updateData.pendingDate = pendingDate ?? null;
    if (completedAt !== undefined)
      updateData.completedAt = completedAt ? new Date(completedAt) : null;
    if (submittedAt !== undefined) updateData.submittedAt = new Date(submittedAt);

    const [ticket] = await db
      .update(ticketsTable)
      .set(updateData)
      .where(eq(ticketsTable.id, paramsParsed.data.id))
      .returning();

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json(normaliseTicket(ticket));
  } catch (err) {
    req.log.error({ err }, "Failed to update ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tickets/:id", async (req, res) => {
  try {
    const parsed = DeleteTicketParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ticket ID" });
      return;
    }

    const [ticket] = await db
      .delete(ticketsTable)
      .where(eq(ticketsTable.id, parsed.data.id))
      .returning();

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete ticket");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
