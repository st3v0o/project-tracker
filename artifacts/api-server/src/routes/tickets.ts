import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import { db, ticketsTable } from "@workspace/db";
import {
  ListTicketsQueryParams,
  CreateTicketBody,
  UpdateTicketBody,
  GetTicketParams,
  UpdateTicketParams,
  DeleteTicketParams,
} from "@workspace/api-zod";
import { eq, and, or, ilike, SQL } from "drizzle-orm";
import { format } from "date-fns";

const router: IRouter = Router();

router.get("/tickets", async (req, res) => {
  try {
    const parsed = ListTicketsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { state, submitter, status, category } = parsed.data;

    const conditions: SQL[] = [];
    if (state) conditions.push(eq(ticketsTable.state, state));
    if (submitter) conditions.push(eq(ticketsTable.submitter, submitter));
    if (status) conditions.push(eq(ticketsTable.status, status));
    if (category) conditions.push(eq(ticketsTable.category, category));

    const tickets =
      conditions.length > 0
        ? await db.select().from(ticketsTable).where(and(...conditions))
        : await db.select().from(ticketsTable);

    const result = tickets.map((t) => ({
      ...t,
      pendingDate: t.pendingDate ?? null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      submittedAt: t.submittedAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list tickets");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tickets/export", async (req, res) => {
  try {
    const parsed = ListTicketsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { state, submitter, status, category } = parsed.data;
    // Optional free-text search matching dashboard behaviour (title OR submitter)
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const conditions: SQL[] = [];
    if (state) conditions.push(eq(ticketsTable.state, state));
    if (submitter) conditions.push(eq(ticketsTable.submitter, submitter));
    if (status) conditions.push(eq(ticketsTable.status, status));
    if (category) conditions.push(eq(ticketsTable.category, category));
    if (search) {
      conditions.push(
        or(
          ilike(ticketsTable.title, `%${search}%`),
          ilike(ticketsTable.submitter, `%${search}%`)
        ) as SQL
      );
    }

    const tickets =
      conditions.length > 0
        ? await db.select().from(ticketsTable).where(and(...conditions))
        : await db.select().from(ticketsTable);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Project Tracker";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tickets");

    // Define columns — keys must match row object properties
    const COLS: { header: string; key: string; minWidth: number }[] = [
      { header: "ID", key: "id", minWidth: 6 },
      { header: "Title", key: "title", minWidth: 20 },
      { header: "Submitter", key: "submitter", minWidth: 14 },
      { header: "State", key: "state", minWidth: 14 },
      { header: "Category", key: "category", minWidth: 16 },
      { header: "Status", key: "status", minWidth: 10 },
      { header: "Description", key: "description", minWidth: 30 },
      { header: "Submitted At", key: "submittedAt", minWidth: 18 },
      { header: "Pending Date", key: "pendingDate", minWidth: 14 },
      { header: "Completed At", key: "completedAt", minWidth: 18 },
      { header: "Time Since (days)", key: "timeSinceDays", minWidth: 18 },
    ];

    sheet.columns = COLS.map((c) => ({ header: c.header, key: c.key, width: c.minWidth }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 22;

    // Track max cell length per column for auto-sizing
    const colWidths: number[] = COLS.map((c) => c.header.length);

    const now = new Date();
    for (const t of tickets) {
      const submittedAt = new Date(t.submittedAt);
      const daysSince = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24));

      const rowValues: Record<string, string | number> = {
        id: t.id,
        title: t.title,
        submitter: t.submitter,
        state: t.state,
        category: t.category,
        status: t.status,
        description: t.description,
        submittedAt: format(submittedAt, "MM/dd/yyyy HH:mm"),
        pendingDate: t.pendingDate ?? "",
        completedAt: t.completedAt ? format(new Date(t.completedAt), "MM/dd/yyyy HH:mm") : "",
        timeSinceDays: daysSince,
      };

      sheet.addRow(rowValues);

      // Update max column widths (cap description at 60)
      COLS.forEach((col, i) => {
        const val = String(rowValues[col.key] ?? "");
        const len = col.key === "description" ? Math.min(val.length, 60) : val.length;
        colWidths[i] = Math.max(colWidths[i], len);
      });
    }

    // Apply computed widths + add a small padding
    sheet.columns.forEach((col, i) => {
      col.width = Math.max(colWidths[i] + 2, COLS[i].minWidth);
    });

    // Zebra stripe rows
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rowNumber % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F3FF" } };
      }
      row.alignment = { vertical: "middle", wrapText: false };
    });

    // Freeze header row + enable auto-filter
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

    const { title, description, state, submitter, category, status, submittedAt } = parsed.data;

    const [ticket] = await db
      .insert(ticketsTable)
      .values({
        title,
        description: description ?? "",
        state,
        submitter,
        category,
        status: status ?? "todo",
        submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
      })
      .returning();

    res.status(201).json({
      ...ticket,
      pendingDate: ticket.pendingDate ?? null,
      completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
      submittedAt: ticket.submittedAt.toISOString(),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    });
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

    res.json({
      ...ticket,
      pendingDate: ticket.pendingDate ?? null,
      completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
      submittedAt: ticket.submittedAt.toISOString(),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    });
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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    const {
      title,
      description,
      state,
      submitter,
      category,
      status,
      pendingDate,
      completedAt,
      submittedAt,
    } = bodyParsed.data;

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (state !== undefined) updateData.state = state;
    if (submitter !== undefined) updateData.submitter = submitter;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
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

    res.json({
      ...ticket,
      pendingDate: ticket.pendingDate ?? null,
      completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
      submittedAt: ticket.submittedAt.toISOString(),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    });
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
