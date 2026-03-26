import { Router, type IRouter } from "express";
import { db, ticketsTable } from "@workspace/db";
import {
  ListTicketsQueryParams,
  CreateTicketBody,
  UpdateTicketBody,
  GetTicketParams,
  UpdateTicketParams,
  DeleteTicketParams,
} from "@workspace/api-zod";
import { eq, and, SQL } from "drizzle-orm";

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
