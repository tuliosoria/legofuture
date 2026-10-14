export type BuyOptionsSurface =
  | "lego-detail"
  | "lego-dashboard"
  | "buyinglist";

export interface BuyOptionsListing {
  itemId: string;
  kind: "asking";
  provider: "ebay";
  observedAt: string;
  sampleSize: 1;
  title: string;
  price?: { value: string; currency: string };
  condition?: string;
  seller?: { username: string; feedbackPercentage?: string };
  imageUrl?: string;
  affiliateUrl: string;
}

export interface BuyOptionsContext {
  surface: BuyOptionsSurface;
  productKey: string;
  productName: string;
  keywords: string;
}
