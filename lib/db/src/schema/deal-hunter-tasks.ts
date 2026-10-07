import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealHunterTasksTable = pgTable("deal_hunter_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  query: text("query").notNull(),
  category: text("category").notNull(),
  keywords: text("keywords").array().notNull().default(sql`ARRAY[]::text[]`),
  maxPrice: real("max_price"),
  minDiscount: real("min_discount").notNull().default(0),
  minRating: real("min_rating").notNull().default(0),
  minReviews: integer("min_reviews").notNull().default(0),
  marketplaces: text("marketplaces")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  priority: text("priority").notNull().default("normal"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDealHunterTaskSchema = createInsertSchema(
  dealHunterTasksTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertDealHunterTask = z.infer<typeof insertDealHunterTaskSchema>;
export type DealHunterTask = typeof dealHunterTasksTable.$inferSelect;
