const EBAY_HOSTS = new Set([
  "ebay.com",
  "www.ebay.com",
  "cgi.ebay.com",
  "m.ebay.com",
]);

// eBay Partner Network commission/tracking params. BricksFuture no longer
// participates in EPN — the site is free with no affiliate links or
// commissions — so we strip every one of these from outbound eBay URLs
// and never add them back. Links point straight at the plain listing.
const EPN_PARAM_KEYS = [
  "mkcid",
  "mkrid",
  "siteid",
  "campid",
  "toolid",
  "mkevt",
  "customid",
] as const;

export interface WrapAffiliateOptions {
  customId?: string;
}

/**
 * Sanitize an eBay destination URL: verify it points at a real eBay host,
 * then strip any pre-existing EPN commission/tracking params so the
 * outbound link earns nothing and carries no attribution. The `options`
 * argument is retained for call-site compatibility but ignored — we no
 * longer attach a `customid`.
 */
export function wrapAffiliateUrl(rawUrl: string, _options?: WrapAffiliateOptions): string {
  const url = new URL(rawUrl);
  if (!EBAY_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to wrap non-eBay URL: ${url.hostname}`);
  }

  for (const key of EPN_PARAM_KEYS) {
    url.searchParams.delete(key);
  }

  return url.toString();
}

/**
 * Single chokepoint for turning an eBay listing into a clean,
 * commission-free destination URL. Use this from every component that
 * renders an eBay link so no EPN params ever leak back in.
 */
export function getEbayAffiliateUrl(
  listing: { itemWebUrl: string },
  options?: WrapAffiliateOptions
): string {
  return wrapAffiliateUrl(listing.itemWebUrl, options);
}

const EBAY_SEARCH_BASE = "https://www.ebay.com/sch/i.html";

/**
 * Build a public-facing eBay search URL for sold completed comps.
 * Routed through the sanitizer so no EPN commission params are attached —
 * the link is a plain, commission-free eBay search.
 */
export function buildEbaySearchUrl(
  keywords: string,
  options?: WrapAffiliateOptions,
): string {
  const url = new URL(EBAY_SEARCH_BASE);
  url.searchParams.set("_nkw", keywords);
  url.searchParams.set("LH_Sold", "1");
  url.searchParams.set("LH_Complete", "1");
  url.searchParams.set("LH_ItemCondition", "1000");
  url.searchParams.set("LH_PrefLoc", "1");
  return wrapAffiliateUrl(url.toString(), options);
}
