export type BuyOptionsSurface =
  | "lego-detail"
  | "lego-dashboard"
  | "buyinglist";

export interface BuyOptionsListing {
  itemId: string;
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
