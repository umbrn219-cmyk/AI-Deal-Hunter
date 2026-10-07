import {
  integer,
  pgTable,
  real,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealHunterProductsTable = pgTable("deal_hunter_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  marketplace: text("marketplace").notNull().default("Mock catalog"),
  seller: text("seller").notNull().default("Synthetic seller"),
  productUrl: text("product_url"),
  currentPrice: real("current_price").notNull(),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  stockStatus: text("stock_status").notNull().default("Demo availability"),
});

export const insertDealHunterProductSchema = createInsertSchema(
  dealHunterProductsTable,
).omit({ id: true });

export type InsertDealHunterProduct = z.infer<
  typeof insertDealHunterProductSchema
>;
export type DealHunterProduct = typeof dealHunterProductsTable.$inferSelect;
