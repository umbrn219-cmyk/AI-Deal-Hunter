import { desc, eq } from "drizzle-orm";
import { db, dealHunterDealsTable, dealHunterNotificationsTable, dealLinkHealthTable, dealIntegrityEventsTable, type DealSnapshot } from "@workspace/db";
import { getMarketplaceAdapter, isFresh, observationIdentity, priceProblem } from "./deal-integrity";
import { ExactProductUrlResolver } from "./exact-product-url-resolver";
import { logger } from "./logger";

export interface LinkHealth {
  status: string;
  checkedAt: string | null;
  currentPrice: number | null;
  resolvedUrl: string | null;
  urlStatus: string;
  reason: string;
}
export function displayStatus(snapshot: DealSnapshot | null, health?: { status: string; checkedAt: Date } | null) {
  if (!snapshot || snapshot.sourceKind === "DEMO" || snapshot.alertDecision !== "SEND_NOTIFICATION") return "UNVERIFIABLE";
  if (health && ["PRICE_CHANGED", "OUT_OF_STOCK", "REMOVED", "INVALID", "EXPIRED"].includes(health.status)) return "EXPIRED";
  if (health?.status === "UNVERIFIABLE") return "PRICE_MAY_HAVE_CHANGED";
  if (!isFresh(snapshot)) {
    return health && ["ACTIVE", "REDIRECTED"].includes(health.status) &&
      Date.now() - health.checkedAt.getTime() <= 60_000 ? "RECENTLY_CHECKED" : "PRICE_MAY_HAVE_CHANGED";
  }
  return "VERIFIED";
}

export async function inspectSnapshot(snapshot: DealSnapshot | null): Promise<LinkHealth & { observation?: unknown; redirectChain?: string[] }> {
  const checkedAt = new Date().toISOString();
  const result = (status: string, reason: string, currentPrice: number | null = null, resolvedUrl: string | null = null, urlStatus = "INVALID"): LinkHealth =>
    ({ status, reason, currentPrice, resolvedUrl, urlStatus, checkedAt });
  if (!snapshot || snapshot.sourceKind === "DEMO" || !snapshot.canonicalProductUrl || snapshot.alertDecision !== "SEND_NOTIFICATION") return result("UNVERIFIABLE", "No verified exact-listing snapshot", null, null, "UNVERIFIABLE");
  const adapter = getMarketplaceAdapter(snapshot.marketplaceId);
  if (!adapter) return result("UNVERIFIABLE", "No permitted marketplace adapter", null, null, "UNVERIFIABLE");
  try {
    // Inspect the STORED destination, not a newly discovered substitute.
    const resolved = await new ExactProductUrlResolver().resolve({ ...snapshot, offerUrl: null, productUrl: snapshot.canonicalProductUrl }, adapter);
    if (resolved.urlStatus !== "VALID") return { ...result("INVALID", resolved.reason ?? "URL_INVALID"), redirectChain: resolved.redirectChain };
    const latest = await adapter.fetchListing(snapshot);
    if (latest.sourceKind !== "LISTING" || latest.productId !== snapshot.productId ||
        latest.productVariantId !== snapshot.productVariantId || latest.sellerId !== snapshot.sellerId ||
        latest.offerId !== snapshot.offerId || latest.marketplaceId !== snapshot.marketplaceId) return result("INVALID", "Identity changed");
    if (latest.availability === "REMOVED") return { ...result("REMOVED", "Listing removed"), observation: latest };
    if (latest.availability !== "IN_STOCK") return { ...result("OUT_OF_STOCK", "Listing unavailable", latest.currentPrice), observation: latest };
    if (priceProblem(latest) || observationIdentity(latest) !== observationIdentity(snapshot)) return { ...result("PRICE_CHANGED", "Deal expired — price has changed.", latest.currentPrice, resolved.canonicalProductUrl, "VALID"), observation: latest };
    if (!isFresh(latest)) return { ...result("EXPIRED", "Price may have changed; observation stale", latest.currentPrice), observation: latest };
    return {
      ...result(resolved.canonicalProductUrl !== snapshot.canonicalProductUrl ? "REDIRECTED" : "ACTIVE",
        "Exact listing rechecked", latest.currentPrice, resolved.canonicalProductUrl, "VALID"),
      observation: latest, redirectChain: resolved.redirectChain,
    };
  } catch { return result("UNVERIFIABLE", "Price may have changed; recheck unavailable", null, null, "UNVERIFIABLE"); }
}

export async function checkDealHealth(deal: typeof dealHunterDealsTable.$inferSelect) {
  const result = await inspectSnapshot(deal.snapshot);
  await db.transaction(async tx => {
    await tx.insert(dealLinkHealthTable).values({
      dealId: deal.id, status: result.status, details: { ...result }, checkedAt: new Date(),
    }).onConflictDoUpdate({ target: dealLinkHealthTable.dealId, set: { status: result.status, details: { ...result }, checkedAt: new Date() } });
    // Changes are append-only events. Never mutate the original alert snapshot.
    await tx.insert(dealIntegrityEventsTable).values({ dealId: deal.id, kind: result.status === "INVALID" ? "URL_INVALID" : result.status, details: { ...result } });
  });
  return result;
}

export function startLinkHealthMonitor() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const rows = await db.select({ deal: dealHunterDealsTable }).from(dealHunterDealsTable)
        .innerJoin(dealHunterNotificationsTable, eq(dealHunterNotificationsTable.dealId, dealHunterDealsTable.id))
        .orderBy(desc(dealHunterNotificationsTable.createdAt)).limit(100);
      for (const { deal } of rows) {
        if (deal.snapshot?.sourceKind === "LISTING") await checkDealHealth(deal);
      }
    } catch (error) { logger.warn({ err: error }, "Deal link-health monitor failed"); }
    finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  return timer;
}
