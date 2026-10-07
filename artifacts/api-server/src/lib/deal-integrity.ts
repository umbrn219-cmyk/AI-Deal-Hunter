import { randomUUID } from "node:crypto";
import type { DealSnapshot, ListingObservation } from "@workspace/db";
import { ExactProductUrlResolver, type MarketplaceAdapter } from "./exact-product-url-resolver";

const adapters = new Map<string, MarketplaceAdapter>();
/** Register only reviewed, permitted APIs. A missing adapter always fails closed. */
export function registerMarketplaceAdapter(adapter: MarketplaceAdapter) {
  if (!adapter.domains.length || adapter.domains.some(domain => !/^[a-z0-9.-]+$/.test(domain))) throw new Error("Invalid marketplace domain allowlist");
  adapters.set(adapter.marketplaceId, adapter);
}
export function getMarketplaceAdapter(id: string) { return adapters.get(id); }
export function maxPriceAgeSeconds() {
  const n = Number(process.env.MAX_PRICE_AGE_SECONDS ?? 60);
  if (!Number.isFinite(n) || n <= 0 || n > 3600) throw new Error("MAX_PRICE_AGE_SECONDS must be in (0, 3600]");
  return n;
}
export function isFresh(observation: ListingObservation, now = Date.now(), maxAge = maxPriceAgeSeconds()) {
  const age = now - Date.parse(observation.priceObservedAt);
  return Number.isFinite(age) && age >= -1000 && age <= maxAge * 1000;
}
export function observationIdentity(o: ListingObservation) {
  return JSON.stringify([o.marketplaceId, o.productId, o.productVariantId, o.sellerId, o.offerId, o.currentPrice, o.currency]);
}
export function priceProblem(o: ListingObservation): string | null {
  if (!Number.isFinite(o.currentPrice) || o.currentPrice <= 0 || !Number.isFinite(o.basePrice) ||
      o.currentPrice !== o.basePrice || o.sellerPrice !== o.basePrice) return "CONDITIONAL_OR_INVALID_PRICE";
  if (o.priceType !== "BASE" || /starting|from\s+[₹\d]|emi|per month|effective|exchange|coupon|bank|cashback/i.test(o.priceConditions.join(" "))) return "CONDITIONAL_PRICE";
  if (!o.productId || !o.productVariantId || !o.sellerId || !o.sellerName || !/^[A-Z]{3}$/.test(o.currency)) return "IDENTITY_INCOMPLETE";
  return null;
}

export interface ValidationResult {
  snapshot: DealSnapshot;
  accepted: boolean;
  reason: string;
  rechecked: ListingObservation | null;
}
export async function validateDeal(
  observed: ListingObservation, referencePrice: number,
  options: { adapter?: MarketplaceAdapter; critical?: boolean; now?: () => number; dealId?: string } = {},
): Promise<ValidationResult> {
  const now = options.now ?? Date.now;
  const adapter = options.adapter ?? getMarketplaceAdapter(observed.marketplaceId);
  const discountPercent = referencePrice > 0 ? Math.max(0, (referencePrice - observed.currentPrice) / referencePrice * 100) : 0;
  let snapshot: DealSnapshot = {
    ...structuredClone(observed), dealId: options.dealId ?? randomUUID(), referencePrice, discountPercent,
    detectedAt: new Date(now()).toISOString(), priceVerificationTimestamp: null,
    priceStatus: observed.sourceKind === "DEMO" ? "DEMO" : "UNVERIFIABLE",
    urlStatus: "UNVERIFIABLE", confidenceScore: 0, redirectChain: [],
    finalResolvedUrl: null, sellerLinkGuaranteed: false, variantLinkGuaranteed: false,
    canonicalProductUrl: null, alertDecision: "NO_ALERT",
  };
  let rechecked: ListingObservation | null = null;
  const finish = (reason: string, accepted = false): ValidationResult => {
    snapshot.alertDecision = accepted ? "SEND_NOTIFICATION" : reason;
    return { snapshot: deepFreeze(snapshot), accepted, reason, rechecked };
  };
  if (observed.sourceKind === "DEMO") return finish("DEMO_UNVERIFIABLE");
  if (!adapter || adapter.marketplaceId !== observed.marketplaceId) return finish("NO_PERMITTED_ADAPTER");
  try {
    // Search prices are never trusted: first inspect the exact listing, then reject
    // the search-originated candidate even if its price happened to match.
    const exact = await adapter.fetchListing(observed);
    rechecked = exact;
    if (observed.sourceKind === "SEARCH") return finish(exact.currentPrice !== observed.currentPrice ? "SEARCH_PRICE_MISMATCH" : "SEARCH_NOT_LISTING_OBSERVATION");
    if (exact.sourceKind !== "LISTING" || priceProblem(observed) || priceProblem(exact)) return finish(priceProblem(observed) ?? priceProblem(exact) ?? "NOT_EXACT_LISTING");
    if (observationIdentity(exact) !== observationIdentity(observed)) {
      snapshot.priceStatus = exact.currentPrice !== observed.currentPrice ? "PRICE_CHANGED" : "IDENTITY_MISMATCH";
      return finish("DEAL_RECHECK_FAILED");
    }
    if (exact.availability !== "IN_STOCK") { snapshot.priceStatus = "OUT_OF_STOCK"; return finish("DEAL_RECHECK_FAILED"); }
    if (!isFresh(exact, now())) { snapshot.priceStatus = "STALE"; return finish("PRICE_STALE"); }
    let resolution = await new ExactProductUrlResolver().resolve(exact, adapter);
    snapshot = { ...snapshot, ...resolution };
    if (resolution.urlStatus !== "VALID") return finish("URL_INVALID");
    // Extreme, anomalous, expensive and critical-task matches get a final fetch
    // AFTER URL inspection, so the resolver cannot consume the freshness window.
    const strong = options.critical || discountPercent >= 90 || referencePrice >= 50_000;
    let verified = exact;
    if (strong) {
      verified = await adapter.fetchListing(exact);
      rechecked = verified;
      if (verified.sourceKind !== "LISTING" || observationIdentity(verified) !== observationIdentity(exact) ||
          priceProblem(verified) || verified.availability !== "IN_STOCK") {
        snapshot.priceStatus = verified.currentPrice !== exact.currentPrice ? "PRICE_CHANGED" : "RECHECK_FAILED";
        return finish("DEAL_RECHECK_FAILED");
      }
      resolution = await new ExactProductUrlResolver().resolve(verified, adapter);
      if (resolution.urlStatus !== "VALID") { snapshot.urlStatus = "INVALID"; return finish("URL_INVALID"); }
    }
    if (!isFresh(verified, now())) { snapshot.priceStatus = "STALE"; return finish("PRICE_STALE"); }
    snapshot = {
      ...snapshot, ...structuredClone(verified), ...resolution,
      priceStatus: "VERIFIED", priceVerificationTimestamp: new Date(now()).toISOString(),
      confidenceScore: strong ? 98 : 95,
    };
    return finish("VERIFIED", true);
  } catch {
    // Errors never turn into successful validation or a fallback search URL.
    snapshot.priceStatus = "UNVERIFIABLE";
    return finish("DEAL_RECHECK_FAILED");
  }
}

function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) if (child && typeof child === "object") deepFreeze(child);
  return Object.freeze(value);
}

export function notificationFromSnapshot(s: DealSnapshot) {
  if (s.alertDecision !== "SEND_NOTIFICATION" || s.priceStatus !== "VERIFIED" ||
      s.sourceKind !== "LISTING" || priceProblem(s) ||
      !s.variantLinkGuaranteed || !s.sellerLinkGuaranteed ||
      s.urlStatus !== "VALID" || !s.canonicalProductUrl || !isFresh(s)) throw new Error("Unverified or stale snapshot cannot generate a deal notification");
  return Object.freeze({
    price: s.currentPrice, url: s.canonicalProductUrl,
    title: `${s.productTitle} ${s.variant}`.trim(),
    message: `${s.productTitle} ${s.variant} · ${s.currency} ${s.currentPrice} · Historical median ${s.referencePrice} · ${s.discountPercent.toFixed(1)}% lower · Seller: ${s.sellerName} · ${s.availability} · Confidence: ${s.confidenceScore}/100 · Price checked: ${s.priceVerificationTimestamp}. Price can change rapidly.`,
  });
}

/** All delivery surfaces use the saved observation, never the mutable catalog. */
export function exactListingNotification(snapshot: DealSnapshot | null) {
  if (!snapshot) return null;
  try { return notificationFromSnapshot(snapshot); }
  catch { return null; } // Legacy, demo, conditional and stale records have no link.
}

export function demoObservation(product: {
  id: string; title: string; brand: string; model: string; seller: string;
  currentPrice: number; stockStatus: string;
}): ListingObservation {
  return {
    marketplaceId: "mock", productId: product.id, productVariantId: `demo-${product.id}`,
    sellerId: "synthetic-seller", sellerName: product.seller, productTitle: product.title,
    brand: product.brand, model: product.model, sku: null, variant: "Synthetic variant (not retailer-verified)",
    color: null, storage: null, size: null, offerId: null, offerUrl: null,
    sellerPrice: product.currentPrice, currentPrice: product.currentPrice, currency: "INR",
    basePrice: product.currentPrice, couponPrice: null, bankOfferPrice: null,
    exchangePrice: null, emiPrice: null, effectivePrice: null, finalPayablePrice: null,
    priceConditions: [], priceType: "BASE", availability: product.stockStatus,
    productUrl: null, canonicalProductUrl: null, sourceUrl: null,
    priceObservedAt: new Date().toISOString(), sourceKind: "DEMO",
  };
}
