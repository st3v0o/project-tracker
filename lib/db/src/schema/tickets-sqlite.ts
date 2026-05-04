import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { customType } from "drizzle-orm/sqlite-core";

const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType() {
    return "TEXT";
  },
  toDriver(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : String(value);
  },
  fromDriver(value: string): string {
    return value;
  },
});

export const ticketsTableSqlite = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  state: text("state").notNull(),
  submitter: text("submitter").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  pendingDate: text("pending_date"),
  completedAt: isoTimestamp("completed_at"),
  submittedAt: isoTimestamp("submitted_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdAt: isoTimestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: isoTimestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
