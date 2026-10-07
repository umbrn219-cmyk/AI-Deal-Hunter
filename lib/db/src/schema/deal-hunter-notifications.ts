import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { dealHunterDealsTable } from "./deal-hunter-deals";

export const dealHunterNotificationsTable = pgTable(
  "deal_hunter_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull().unique(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    kind: text("kind").notNull(),
    read: boolean("read").notNull().default(false),
    dealId: uuid("deal_id").references(() => dealHunterDealsTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertDealHunterNotificationSchema = createInsertSchema(
  dealHunterNotificationsTable,
).omit({ id: true, createdAt: true });

export type InsertDealHunterNotification = z.infer<
  typeof insertDealHunterNotificationSchema
>;
export type DealHunterNotification =
  typeof dealHunterNotificationsTable.$inferSelect;
