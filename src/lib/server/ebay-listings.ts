import { searchEbayByKeywords, wrapAffiliateUrl } from "@/lib/api/ebay";

export interface BuyOptionsListing {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  condition?: string;
  seller?: { username: string; feedbackPercentage?: string };
  imageUrl?: string;
  affiliateUrl: string;
}

export interface FetchEbayListingsArgs {
  keywords: string;
  customId: string;
}

/**
 * Fetch up to 50 fixed-price eBay listings for a keyword search and
 * map each `itemSummary` into the drawer-facing `BuyOptionsListing`
 * shape with the affiliate URL pre-wrapped.
 *
 * Throws if the underlying eBay Browse call fails, callers should
 * catch and surface a 500.
 */
export async function fetchEbayListings(
  args: FetchEbayListingsArgs
): Promise<BuyOptionsListing[]> {
  const browse = await searchEbayByKeywords({
    keywords: args.keywords,
    limit: 50,
    filter: "buyingOptions:{FIXED_PRICE}",
  });

  return (browse.itemSummaries ?? []).map((item) => ({
    itemId: item.itemId,
    title: item.title,
    price: item.price,
    condition: item.condition,
    seller:
      item.seller && item.seller.username
        ? {
            username: item.seller.username,
            feedbackPercentage: item.seller.feedbackPercentage,
          }
        : undefined,
    imageUrl: item.image?.imageUrl,
    affiliateUrl: wrapAffiliateUrl(item.itemWebUrl, { customId: args.customId }),
  }));
}
