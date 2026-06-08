import type {
  EbayBrowsePaginatedResult,
  EbayBrowseSearchInput,
  EbayBrowseSearchResponse,
  EbayListing,
} from "./types";
import { getEbayAccessToken } from "./token";

const BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

export async function searchEbayByKeywords(
  input: EbayBrowseSearchInput,
): Promise<EbayBrowseSearchResponse> {
  const params = new URLSearchParams({ q: input.keywords });
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  if (input.filter) params.set("filter", input.filter);
  if (input.categoryIds) params.set("category_ids", input.categoryIds);

  const token = await getEbayAccessToken();

  const res = await fetch(`${BROWSE_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`eBay Browse search failed: HTTP ${res.status} ${text}`);
  }

  return (await res.json()) as EbayBrowseSearchResponse;
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
  const maxPages = Math.max(1, opts.maxPages ?? 4);
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

    const token = await getEbayAccessToken();
    const res = await fetch(`${BROWSE_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`eBay Browse search failed: HTTP ${res.status} ${text}`);
    }
    const body = (await res.json()) as EbayBrowseSearchResponse;
    if (pages === 0) total = body.total ?? 0;
    const batch = body.itemSummaries ?? [];
    items.push(...batch);
    pages += 1;
    if (batch.length < limit || !body.next) break;
    offset += limit;
  }

  return { items, total: total || items.length, pagesFetched: pages };
}
