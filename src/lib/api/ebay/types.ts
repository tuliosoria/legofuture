export interface EbayOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface CachedEbayToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export interface EbayBrowseSearchInput {
  keywords: string;
  limit?: number;
  filter?: string;
  categoryIds?: string;
}

export interface EbayListing {
  itemId: string;
  title: string;
  /**
   * Raw eBay product URL. Do NOT link to this directly from any
   * user-clickable surface, affiliate attribution will be lost.
   * Always pass through `wrapAffiliateUrl()` (see `./affiliate.ts`)
   * or use the `getEbayAffiliateUrl()` helper.
   */
  itemWebUrl: string;
  price: { value: string; currency: string };
  condition?: string;
  seller?: { username?: string; feedbackPercentage?: string; feedbackScore?: number };
  image?: { imageUrl: string };
  shippingOptions?: Array<{ shippingCost?: { value: string; currency: string } }>;
}

export interface EbayBrowseSearchResponse {
  itemSummaries?: EbayListing[];
  total?: number;
  href?: string;
  offset?: number;
  limit?: number;
  next?: string;
}

export interface EbayBrowsePaginatedResult {
  items: EbayListing[];
  /** Server-side total match count from the Browse API's `total`
   * field. Falls back to `items.length` if the API omitted it. */
  total: number;
  pagesFetched: number;
}
