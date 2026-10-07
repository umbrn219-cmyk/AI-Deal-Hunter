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
    // Only URLs supplied by this very observation may be selected.
    const original = listing.offerUrl ?? listing.canonicalProductUrl ?? listing.productUrl;
    if (!original || !permittedUrl(original, adapter) || isGenericPage(original)) return invalid("URL_INVALID");
    const sourceIdentity = adapter.identityFromUrl(original);
    if (!sourceIdentity || sourceIdentity.productId !== listing.productId) return invalid("PRODUCT_URL_MISMATCH");
    const resolved = await adapter.inspectUrl(original);
    const chain = [original, ...resolved.redirectChain, resolved.finalUrl];
    if (chain.length > 12 || chain.some(url => !permittedUrl(url, adapter) || isGenericPage(url))) return invalid("REDIRECT_INVALID", chain, resolved.finalUrl);
    const same = (identity: UrlIdentity | null) => identity &&
      identity.productId === listing.productId &&
      (!adapter.variantSpecificUrls || identity.productVariantId === listing.productVariantId) &&
      (!adapter.sellerSpecificUrls || identity.sellerId === listing.sellerId) &&
      (!adapter.offerSpecificUrls || !listing.offerId || identity.offerId === listing.offerId);
    if (resolved.pageKind !== "LISTING" || !same(resolved.identity) ||
        chain.some(url => !same(adapter.identityFromUrl(url)))) {
      return invalid("IDENTITY_URL_MISMATCH", chain, resolved.finalUrl);
    }
    const canonical = new URL(resolved.finalUrl);
    for (const key of adapter.trackingParameters) canonical.searchParams.delete(key);
    canonical.hash = "";
    if (!same(adapter.identityFromUrl(canonical.href))) return invalid("CANONICAL_IDENTITY_MISMATCH", chain, resolved.finalUrl);
    return {
      urlStatus: "VALID", canonicalProductUrl: canonical.href,
      finalResolvedUrl: resolved.finalUrl, redirectChain: chain, reason: null,
      sellerLinkGuaranteed: adapter.sellerSpecificUrls,
      variantLinkGuaranteed: adapter.variantSpecificUrls,
    };
  }
}
