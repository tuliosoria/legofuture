import type {
  EbayBrowsePaginatedResult,
  EbayBrowseSearchInput,
  EbayBrowseSearchResponse,
  EbayListing,
} from "./types";
import { requestEbay } from "./request-policy";

function policy(page=1, maxPages=4) { return {fetchImpl:fetch, now:Date.now, appBudgetKey:"ebay-app", dailyLimit:Number(process.env.EBAY_VERIFIED_DAILY_LIMIT), maxPages, page}; }

const BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

export async function searchEbayByKeywords(
  input: EbayBrowseSearchInput,
): Promise<EbayBrowseSearchResponse> {
  const params = new URLSearchParams({ q: input.keywords });
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  if (input.filter) params.set("filter", input.filter);
  if (input.categoryIds) params.set("category_ids", input.categoryIds);

  const res = await requestEbay(`${BROWSE_URL}?${params.toString()}`, policy());

  try { return (await res.json()) as EbayBrowseSearchResponse; } catch { throw new Error("invalid-data"); }
}

export interface PaginateOptions {
  /** Hard ceiling on pages fetched. Default 4 → 200 items at limit=50. */
  maxPages?: number;
}

/**
 * Paginate the Browse API up to `maxPages` (default 4). Returns the
 * concatenated `itemSummaries` plus the server-side `total` from the
 * first response so callers can surface a true supply count even when
 * the filtered/single-unit subset that fits in a single page is small.
 */
export async function searchEbayByKeywordsAll(
  input: EbayBrowseSearchInput,
  opts: PaginateOptions = {},
): Promise<EbayBrowsePaginatedResult> {
  const maxPages = Math.min(4, Math.max(1, Math.floor(opts.maxPages ?? 4)));
  const limit = input.limit ?? 50;
  const items: EbayListing[] = [];
  let total = 0;
  let offset = 0;
  let pages = 0;

  while (pages < maxPages) {
    const params = new URLSearchParams({
      q: input.keywords,
      limit: String(limit),
      offset: String(offset),
    });
    if (input.filter) params.set("filter", input.filter);
    if (input.categoryIds) params.set("category_ids", input.categoryIds);

    const res = await requestEbay(`${BROWSE_URL}?${params.toString()}`, policy(pages+1,maxPages));
    let body: EbayBrowseSearchResponse;
    try { body = await res.json(); } catch { throw new Error("invalid-data"); }
    if (pages === 0) total = body.total ?? 0;
    const batch = body.itemSummaries ?? [];
    items.push(...batch);
    pages += 1;
    if (batch.length < limit || !body.next) break;
    offset += limit;
  }

  return { items, total: total || items.length, pagesFetched: pages };
}
