import type { ListingObservation } from "@workspace/db";

export interface UrlIdentity {
  productId: string;
  productVariantId: string | null;
  sellerId: string | null;
  offerId: string | null;
}
export interface UrlInspection {
  finalUrl: string;
  redirectChain: string[];
  identity: UrlIdentity;
  pageKind: "LISTING" | "SEARCH" | "CATEGORY" | "LOGIN" | "ERROR";
}
/** Implement only using an approved marketplace API. No arbitrary URL fetching. */
export interface MarketplaceAdapter {
  marketplaceId: string;
  domains: readonly string[];
  variantSpecificUrls: boolean;
  sellerSpecificUrls: boolean;
  offerSpecificUrls: boolean;
  fetchListing(identity: ListingObservation): Promise<ListingObservation>;
  inspectUrl(url: string): Promise<UrlInspection>;
  identityFromUrl(url: string): UrlIdentity | null;
  /** Explicitly documented safe tracking parameters; preserve all other query keys. */
  trackingParameters: readonly string[];
}

export function isGenericPage(raw: string): boolean {
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return !path || /^\/(search|s|category|categories|brand|brands|collection|collections|login|signin|error|404|smartphones|electronics)(\/|$)/.test(path);
  } catch { return true; }
}
export function permittedUrl(raw: string, adapter: MarketplaceAdapter): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") &&
      adapter.domains.includes(url.hostname.toLowerCase());
  } catch { return false; }
}

export class ExactProductUrlResolver {
  async resolve(listing: ListingObservation, adapter: MarketplaceAdapter) {
    const invalid = (reason: string, chain: string[] = [], finalUrl: string | null = null) =>
      ({ urlStatus: "INVALID", canonicalProductUrl: null, finalResolvedUrl: finalUrl, redirectChain: chain, reason, sellerLinkGuaranteed: false, variantLinkGuaranteed: false });
    // A product-only page can default to another variant or seller. Do not
    // advertise the observed price unless this destination selects both.
    if (!adapter.variantSpecificUrls || !adapter.sellerSpecificUrls ||
        (listing.offerId && !adapter.offerSpecificUrls)) return invalid("EXACT_LISTING_LINK_UNAVAILABLE");
    const same = (identity: UrlIdentity | null) => identity &&
      identity.productId === listing.productId &&
      identity.productVariantId === listing.productVariantId &&
      identity.sellerId === listing.sellerId &&
      (!listing.offerId || identity.offerId === listing.offerId);
    const identityAt = (url: string) => {
      try { return adapter.identityFromUrl(url); }
      catch { return null; }
    };
    // Try URLs attached to this exact observation. A generic offer/search URL
    // must not hide a usable canonical listing URL from the same observation.
    const candidates = [...new Set([
      listing.offerUrl, listing.canonicalProductUrl, listing.productUrl,
    ].filter((url): url is string => Boolean(url)))];
    let lastFailure = invalid("URL_INVALID");
    for (const original of candidates) {
      if (!permittedUrl(original, adapter) || isGenericPage(original)) continue;
      if (!same(identityAt(original))) {
        lastFailure = invalid("PRODUCT_URL_MISMATCH");
        continue;
      }
      let resolved: UrlInspection;
      try { resolved = await adapter.inspectUrl(original); }
      catch {
        lastFailure = invalid("URL_INSPECTION_FAILED");
        continue;
      }
      const chain = [original, ...resolved.redirectChain, resolved.finalUrl];
      if (chain.length > 12 || chain.some(url => !permittedUrl(url, adapter) || isGenericPage(url))) {
        lastFailure = invalid("REDIRECT_INVALID", chain, resolved.finalUrl);
        continue;
      }
      if (resolved.pageKind !== "LISTING" || !same(resolved.identity) ||
          chain.some(url => !same(identityAt(url)))) {
        lastFailure = invalid("IDENTITY_URL_MISMATCH", chain, resolved.finalUrl);
        continue;
      }
      const canonical = new URL(resolved.finalUrl);
      for (const key of adapter.trackingParameters) canonical.searchParams.delete(key);
      canonical.hash = "";
      if (!same(identityAt(canonical.href))) {
        lastFailure = invalid("CANONICAL_IDENTITY_MISMATCH", chain, resolved.finalUrl);
        continue;
      }
      return {
        urlStatus: "VALID", canonicalProductUrl: canonical.href,
        finalResolvedUrl: resolved.finalUrl, redirectChain: chain, reason: null,
        sellerLinkGuaranteed: adapter.sellerSpecificUrls,
        variantLinkGuaranteed: adapter.variantSpecificUrls,
      };
    }
    return lastFailure;
  }
}
