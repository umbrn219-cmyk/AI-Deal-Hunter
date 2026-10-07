import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealHunterScanRunsTable = pgTable("deal_hunter_scan_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull(),
  scannedProducts: integer("scanned_products").notNull(),
  matchedDeals: integer("matched_deals").notNull(),
  newAlerts: integer("new_alerts").notNull(),
  duplicateAlertsPrevented: integer("duplicate_alerts_prevented").notNull(),
  durationMs: integer("duration_ms").notNull(),
  demo: integer("demo").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDealHunterScanRunSchema = createInsertSchema(
  dealHunterScanRunsTable,
).omit({ id: true, createdAt: true });

export type InsertDealHunterScanRun = z.infer<
  typeof insertDealHunterScanRunSchema
>;
export type DealHunterScanRun = typeof dealHunterScanRunsTable.$inferSelect;
