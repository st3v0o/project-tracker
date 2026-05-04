import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { customType } from "drizzle-orm/sqlite-core";

/**
 * SQLite-compatible timestamp column that stores ISO-8601 strings on disk
 * but exposes JavaScript Date objects to the application layer — matching
 * the behaviour of drizzle-orm/pg-core's `timestamp` column type.
 */
const isoDate = customType<{ data: Date; driverData: string }>({
  dataType() {
    return "TEXT";
  },
  toDriver(value: Date): string {
    return value instanceof Date ? value.toISOString() : String(value);
  },
  fromDriver(value: string): Date {
    return new Date(value);
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
  completedAt: isoDate("completed_at"),
  submittedAt: isoDate("submitted_at")
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: isoDate("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: isoDate("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});
