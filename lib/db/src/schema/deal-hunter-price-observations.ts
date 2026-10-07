import {
  pgTable,
  jsonb,
  real,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealHunterProductsTable } from "./deal-hunter-products";
import type { ListingObservation } from "./deal-integrity";

export const dealHunterPriceObservationsTable = pgTable(
  "deal_hunter_price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => dealHunterProductsTable.id, { onDelete: "cascade" }),
    price: real("price").notNull(),
    listing: jsonb("listing").$type<ListingObservation>(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertDealHunterPriceObservationSchema = createInsertSchema(
  dealHunterPriceObservationsTable,
).omit({ id: true, observedAt: true });

export type InsertDealHunterPriceObservation = z.infer<
  typeof insertDealHunterPriceObservationSchema
>;
export type DealHunterPriceObservation =
  typeof dealHunterPriceObservationsTable.$inferSelect;
