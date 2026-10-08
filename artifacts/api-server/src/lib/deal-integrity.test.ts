import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ListingObservation } from "@workspace/db";
import { notificationFromSnapshot, validateDeal } from "./deal-integrity";
import type { MarketplaceAdapter, UrlIdentity } from "./exact-product-url-resolver";

const exactUrl = "https://shop.example/product/iphone-15?variant=128gb&seller=main";

function listing(overrides: Partial<ListingObservation> = {}): ListingObservation {
  return {
    marketplaceId: "shop", productId: "iphone-15", productVariantId: "iphone-15-128gb",
    sellerId: "main", sellerName: "Main seller", productTitle: "iPhone 15", brand: "Apple",
    model: "iPhone 15", sku: "IP15-128", variant: "128GB", color: "Black", storage: "128GB",
    size: null, offerId: null, offerUrl: null, sellerPrice: 9999, currentPrice: 9999,
    currency: "INR", basePrice: 9999, couponPrice: null, bankOfferPrice: null,
    exchangePrice: null, emiPrice: null, effectivePrice: null, finalPayablePrice: null,
    priceConditions: [], priceType: "BASE", availability: "IN_STOCK", productUrl: exactUrl,
    canonicalProductUrl: exactUrl, sourceUrl: null, priceObservedAt: new Date().toISOString(),
    sourceKind: "LISTING", ...overrides,
  };
}

function adapterFor(
  observed: ListingObservation,
  afterRecheck?: ListingObservation,
): MarketplaceAdapter {
  let fetches = 0;
  const identityFromUrl = (raw: string): UrlIdentity | null => {
    try {
      const url = new URL(raw);
      return {
        productId: "iphone-15",
        productVariantId: url.searchParams.get("variant") === "128gb" ? "iphone-15-128gb" : "iphone-15-256gb",
        sellerId: url.searchParams.get("seller"),
        offerId: null,
      };
    } catch { return null; }
  };
  return {
    marketplaceId: "shop", domains: ["shop.example"], variantSpecificUrls: true,
    sellerSpecificUrls: true, offerSpecificUrls: true, trackingParameters: ["utm_source"],
    fetchListing: async () => {
      fetches += 1;
      return structuredClone(fetches > 1 && afterRecheck ? afterRecheck : observed);
    },
    inspectUrl: async url => ({
      finalUrl: url, redirectChain: [], identity: identityFromUrl(url)!,
      pageKind: "LISTING",
    }),
    identityFromUrl,
  };
}

describe("exact-listing deal notifications", () => {
  it("opens the same 128GB listing that produced the detected ₹9,999 price", async () => {
    const observed = listing();
    const result = await validateDeal(observed, 20_000, {
      adapter: adapterFor(observed), now: Date.now,
    });

    assert.equal(result.accepted, true);
    const notification = notificationFromSnapshot(result.snapshot);
    assert.equal(notification.price, 9999);
    assert.equal(notification.url, exactUrl);
    assert.match(notification.title, /128GB/);
    assert.equal(result.snapshot.productVariantId, "iphone-15-128gb");
    assert.equal(result.snapshot.sellerId, "main");
    assert.match(notification.message, /INR 9999/);
  });

  it("does not alert on a price above 90% off if the exact listing changes on recheck", async () => {
    const observed = listing();
    const changed = listing({
      currentPrice: 19_999, basePrice: 19_999, sellerPrice: 19_999,
      priceObservedAt: new Date().toISOString(),
    });
    const result = await validateDeal(observed, 130_000, {
      adapter: adapterFor(observed, changed), now: Date.now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "DEAL_RECHECK_FAILED");
    assert.equal(result.snapshot.priceStatus, "PRICE_CHANGED");
    assert.throws(() => notificationFromSnapshot(result.snapshot), /cannot generate/);
  });

  it("rejects a destination for the 256GB variant when the detected offer is 128GB", async () => {
    const observed = listing({
      productUrl: "https://shop.example/product/iphone-15?variant=256gb&seller=main",
      canonicalProductUrl: "https://shop.example/product/iphone-15?variant=256gb&seller=main",
    });
    const result = await validateDeal(observed, 20_000, {
      adapter: adapterFor(observed), now: Date.now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "URL_INVALID");
  });

  it("uses the exact listing from the observation instead of its generic offer-search URL", async () => {
    const observed = listing({
      offerUrl: "https://shop.example/search?q=iphone+15",
      productUrl: exactUrl,
      canonicalProductUrl: exactUrl,
    });
    const result = await validateDeal(observed, 20_000, {
      adapter: adapterFor(observed), now: Date.now,
    });

    assert.equal(result.accepted, true);
    assert.equal(notificationFromSnapshot(result.snapshot).url, exactUrl);
  });

  it("rejects a destination for a different seller", async () => {
    const observed = listing({
      productUrl: "https://shop.example/product/iphone-15?variant=128gb&seller=other",
      canonicalProductUrl: "https://shop.example/product/iphone-15?variant=128gb&seller=other",
    });
    const result = await validateDeal(observed, 20_000, {
      adapter: adapterFor(observed), now: Date.now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "URL_INVALID");
  });

  it("rejects coupon, bank, exchange, and other conditional prices", async () => {
    const observed = listing({
      priceConditions: ["₹9,999 after bank offer"],
    });
    const result = await validateDeal(observed, 20_000, {
      adapter: adapterFor(observed), now: Date.now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "CONDITIONAL_PRICE");
  });

  it("never promotes a search result into an exact-listing notification", async () => {
    const observed = listing({ sourceKind: "SEARCH" });
    const result = await validateDeal(observed, 20_000, {
      adapter: adapterFor(observed), now: Date.now,
    });

    assert.equal(result.accepted, false);
    assert.equal(result.reason, "SEARCH_NOT_LISTING_OBSERVATION");
  });
});
