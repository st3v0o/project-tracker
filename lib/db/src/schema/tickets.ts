import { pgTable, serial, text, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  state: text("state").notNull(),
  submitter: text("submitter").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  pendingDate: date("pending_date"),
  completedAt: timestamp("completed_at"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
