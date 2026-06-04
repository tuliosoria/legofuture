/**
 * MVP LegoSet type — single source of truth for the static catalog
 * consumed by /buying-list, /set-forecast, /set-forecast/[slug], and /.
 *
 * Distinct from the screener's DDB-backed types. Lives alongside them
 * so the site can swap pages back to live data later without refactoring
 * the MVP surface.
 */
export type LegoSetStatus = "Active" | "Retiring soon" | "Retired";
export type LegoSetSignal = "Strong Buy" | "Buy" | "Watch" | "Hold" | "Sell";
export type LegoSetConfLabel = "High" | "Medium" | "Low";

export interface LegoSet {
  id: string;
  name: string;
  setNumber: string;
  theme: string;
  productType: string;
  year: number;
  status: LegoSetStatus;
  msrp: number;
  currentPrice: number;
  proj5y: number;
  bear: number;
  bull: number;
  score: number;
  signal: LegoSetSignal;
  confidence: 1 | 2 | 3 | 4 | 5;
  confLabel: LegoSetConfLabel;
  pieces: number;
  communityScore: number;
  momentum: string;
  liquidity: string;
  priceAgreement: string;
  thesis: string;
}
