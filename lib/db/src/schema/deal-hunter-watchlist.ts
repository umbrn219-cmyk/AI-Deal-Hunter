import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealHunterWatchlistTable = pgTable("deal_hunter_watchlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDealHunterWatchlistSchema = createInsertSchema(
  dealHunterWatchlistTable,
).omit({ id: true, createdAt: true });

export type InsertDealHunterWatchlist = z.infer<
  typeof insertDealHunterWatchlistSchema
>;
export type DealHunterWatchlist =
  typeof dealHunterWatchlistTable.$inferSelect;
