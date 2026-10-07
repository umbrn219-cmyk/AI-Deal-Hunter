import { pgTable, uuid, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/** All fields come from one permitted listing observation, never a title search. */
export interface ListingObservation {
  marketplaceId: string;
  productId: string;
  productVariantId: string;
  sellerId: string;
  sellerName: string;
  productTitle: string;
  brand: string;
  model: string;
  sku: string | null;
  variant: string;
  color: string | null;
  storage: string | null;
  size: string | null;
  offerId: string | null;
  offerUrl: string | null;
  sellerPrice: number;
  currentPrice: number;
  currency: string;
  basePrice: number;
  couponPrice: number | null;
  bankOfferPrice: number | null;
  exchangePrice: number | null;
  emiPrice: number | null;
  effectivePrice: number | null;
  finalPayablePrice: number | null;
  priceConditions: string[];
  priceType: "BASE" | "STARTING_FROM" | "EMI" | "COUPON" | "BANK" | "EXCHANGE" | "EFFECTIVE";
  availability: string;
  productUrl: string | null;
  canonicalProductUrl: string | null;
  sourceUrl: string | null;
  priceObservedAt: string;
  sourceKind: "LISTING" | "SEARCH" | "DEMO";
}

export interface DealSnapshot extends ListingObservation {
  dealId: string;
  referencePrice: number;
  discountPercent: number;
  detectedAt: string;
  priceVerificationTimestamp: string | null;
  priceStatus: string;
  urlStatus: string;
  confidenceScore: number;
  redirectChain: string[];
  finalResolvedUrl: string | null;
  sellerLinkGuaranteed: boolean;
  variantLinkGuaranteed: boolean;
  alertDecision: string;
}

export const dealIntegrityEventsTable = pgTable("deal_integrity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id").notNull(),
  kind: text("kind").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dealLinkHealthTable = pgTable("deal_link_health", {
  dealId: uuid("deal_id").primaryKey(),
  status: text("status").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dealClicksTable = pgTable("deal_clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id"),
  dealId: uuid("deal_id").notNull(),
  destinationUrl: text("destination_url"),
  resolvedUrl: text("resolved_url"),
  urlStatus: text("url_status").notNull(),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertDealIntegrityEventSchema = createInsertSchema(dealIntegrityEventsTable).omit({ id: true, createdAt: true });
export const insertDealLinkHealthSchema = createInsertSchema(dealLinkHealthTable).omit({ checkedAt: true });
export const insertDealClickSchema = createInsertSchema(dealClicksTable).omit({ id: true, clickedAt: true });
