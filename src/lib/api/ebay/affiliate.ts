const EBAY_HOSTS = new Set([
  "ebay.com",
  "www.ebay.com",
  "cgi.ebay.com",
  "m.ebay.com",
]);

const EPN_PARAM_KEYS = [
  "mkcid",
  "mkrid",
  "siteid",
  "campid",
  "toolid",
  "mkevt",
  "customid",
] as const;

const CUSTOM_ID_MAX_LEN = 240;

export interface WrapAffiliateOptions {
  customId?: string;
}

export function wrapAffiliateUrl(rawUrl: string, options?: WrapAffiliateOptions): string {
  const url = new URL(rawUrl);
  if (!EBAY_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to wrap non-eBay URL: ${url.hostname}`);
  }

  for (const key of EPN_PARAM_KEYS) {
    url.searchParams.delete(key);
  }

  url.searchParams.set("mkcid", "1");
  url.searchParams.set("mkrid", process.env.EPN_ROVER_ID ?? "711-53200-19255-0");
  url.searchParams.set("siteid", "0");
  url.searchParams.set("campid", process.env.EPN_CAMPAIGN_ID ?? "5339119183");
  url.searchParams.set("toolid", "80008");
  url.searchParams.set("mkevt", "1");

  if (options?.customId) {
    url.searchParams.set("customid", options.customId.slice(0, CUSTOM_ID_MAX_LEN));
  }

  return url.toString();
}

/**
 * Single chokepoint for converting an eBay listing into a
 * user-clickable affiliate-attributed URL. Use this from every
 * component that renders an eBay destination link so the six EPN
 * params are always present.
 */
export function getEbayAffiliateUrl(
  listing: { itemWebUrl: string },
  options?: WrapAffiliateOptions
): string {
  return wrapAffiliateUrl(listing.itemWebUrl, options);
}

const EBAY_SEARCH_BASE = "https://www.ebay.com/sch/i.html";

/**
 * Build a public-facing eBay search URL for sold completed sealed comps,
 * then route through affiliate attribution so outbound clicks earn EPN
 * commission and can be traced via customId.
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
