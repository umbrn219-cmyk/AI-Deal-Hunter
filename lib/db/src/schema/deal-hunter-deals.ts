import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealHunterProductsTable } from "./deal-hunter-products";

export const dealHunterDealsTable = pgTable("deal_hunter_deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  fingerprint: text("fingerprint").notNull().unique(),
  productId: uuid("product_id")
    .notNull()
    .references(() => dealHunterProductsTable.id, { onDelete: "cascade" }),
  currentPrice: real("current_price").notNull(),
  historicalMedian: real("historical_median").notNull(),
  historicalLow: real("historical_low").notNull(),
  observedHigh: real("observed_high").notNull(),
  realDiscountPercent: real("real_discount_percent").notNull(),
  historicalDiscountPercent: real("historical_discount_percent").notNull(),
  anomalyScore: integer("anomaly_score").notNull(),
  confidence: integer("confidence").notNull(),
  dealScore: integer("deal_score").notNull(),
  classification: text("classification").notNull(),
  matchedTaskNames: text("matched_task_names")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDealHunterDealSchema = createInsertSchema(
  dealHunterDealsTable,
).omit({ id: true, createdAt: true });

export type InsertDealHunterDeal = z.infer<typeof insertDealHunterDealSchema>;
export type DealHunterDeal = typeof dealHunterDealsTable.$inferSelect;
