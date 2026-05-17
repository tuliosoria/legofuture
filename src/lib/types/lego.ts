export type LegoTheme =
  | "Star Wars"
  | "Technic"
  | "Architecture"
  | "Modular Buildings"
  | "Icons"
  | "Ideas"
  | "Harry Potter"
  | "Marvel"
  | "Friends"
  | "GWP"
  | "Other";

export type ProductStatus = "retired" | "current";

/** User-facing recommendation signal */
export type Recommendation = "buy" | "hold" | "sell";

export type Confidence = "high" | "medium" | "low";

/** Forecast scenario: pessimist = 0.5× base CAGR, optimist = 1.5× */
export type Scenario = "pessimist" | "moderate" | "optimist";

/** A LEGO set in the catalog */
export interface LegoSet {
  id: string;
  setNumber: string;
  name: string;
  theme: LegoTheme;
  subtheme?: string;
  releaseYear: number;
  /** true when officially retired by LEGO */
  retired: boolean;
  pieceCount: number;
  minifigCount: number;
  /** Original MSRP in USD */
  originalMsrp: number;
  imageUrl: string;
  slug: string;
}

/** Pricing snapshot sourced from PriceCharting */
export interface ProductPricing {
  /** Factory-sealed / "new" price */
  newPrice: number | null;
  /** Complete-in-box price */
  cibPrice: number | null;
  /** Loose / opened price */
  loosePrice: number | null;
  salesVolume: number | null;
  lastFetched: string;
}

export interface ScenarioOutlook {
  projectedValue: number;
  dollarGain: number;
  roiPercent: number;
  annualRate: number;
  signal: "Buy" | "Hold" | "Sell";
}

export type ForecastStatus = "ready" | "too_new" | "insufficient_data";

export interface Forecast {
  id: string;
  currentPrice: number;
  projectedValue: number;
  dollarGain: number;
  roiPercent: number;
  annualRate: number;
  signal: "Buy" | "Hold" | "Sell";
  confidence: Confidence;
  status: ForecastStatus;
  statusMessage: string | null;
  predictionSpreadPercent: number;
  scenarios: Record<Scenario, ScenarioOutlook>;
}

export interface ProjectionPoint {
  label: string;
  month: number;
  /** Projected set value (indexed to $1 000 at month 0) */
  setValue: number;
  /** S&P 500 benchmark (indexed to $1 000 at month 0) */
  sp500: number;
}

/** A single point in a synthetic monthly price history */
export interface HistoryPoint {
  date: string;
  price: number;
}
