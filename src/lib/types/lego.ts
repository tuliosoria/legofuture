export type LegoTheme =
  | "Technic"
  | "Star Wars"
  | "Icons"
  | "Creator Expert"
  | "Ideas"
  | "City"
  | "Architecture"
  | "Botanical"
  | "Seasonal"
  | "Modular Buildings"
  | "Harry Potter"
  | "Marvel"
  | "DC"
  | "Minecraft"
  | "Friends"
  | "Disney"
  | "Speed Champions"
  | "Ninjago"
  | "GWP"
  | "Other";

export type LegoEra = "Classic" | "Modern" | "Licensed" | "Premium";

export type ProductStatus = "retired" | "current";

export type LegoCondition = "new-sealed" | "complete" | "loose";

/** User-facing recommendation signal */
export type Recommendation = "buy" | "hold" | "sell";

export type Confidence = "high" | "medium" | "low";

export type ProductType =
  | "Boxed Set"
  | "Polybag"
  | "Minifigure Pack"
  | "Gear"
  | "Keychain"
  | "Watch"
  | "Plush"
  | "Book"
  | "Video Game"
  | "Bag / Case"
  | "Accessory"
  | "Unknown";

export type InvestmentUniverse =
  | "InvestableSet"
  | "RetiredTracker"
  | "CollectorCatalog"
  | "DataIssue";

export type LiquidityTier = "High" | "Medium" | "Low" | "Insufficient";

export type ScreenerSignal = "Strong Buy" | "Buy" | "Watch" | "Avoid" | "DataIssue";

/** Forecast scenario: pessimist = 0.5× base CAGR, optimist = 1.5× */
export type Scenario = "pessimist" | "moderate" | "optimist";

export type EnrichmentStatus =
  | "rebrickable-only"
  | "pricecharting-only"
  | "fully-enriched"
  | "legacy-curated";

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
  /** null if still active; otherwise calendar year of retirement */
  retirementYear?: number | null;
  retiringSoon?: boolean;
  productionRunYears?: number;
  pieceCount: number;
  minifigCount: number;
  hasExclusiveMinifigs?: boolean;
  /** Original MSRP in USD */
  originalMsrp: number;
  imageUrl: string;
  slug: string;
  era?: LegoEra;
  /** first 2-3 digits of setNumber — era/line proxy */
  setNumberPrefix?: string;
  /** stable identifier only — never used for live API */
  rebrickableId?: string;
  /** sparse-data guard */
  forecastEligible?: boolean;
  enrichmentStatus?: EnrichmentStatus;
  pricingProviderCount?: number;
  productType?: ProductType;
  investmentUniverse?: InvestmentUniverse;
  /** eBay sold comps in last 90 days — populated by sync:ebay-comps script */
  soldComps90d?: number;
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

/**
 * Source of the `currentPrice` used to build the forecast.
 *  - "market"    — at least one external source (PC/BL/Brickset/eBay) supplied a price
 *  - "msrp"      — fell back to the original MSRP
 *  - "estimated" — synthesized from piece count × theme median $/piece
 *  - "unknown"   — no signal at all (currentPrice is 0)
 */
export type PriceSource = "market" | "msrp" | "estimated" | "unknown";

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
  /** Tells the UI whether `currentPrice` came from real data or was synthesized. */
  priceSource?: PriceSource;
  estimatedNetGain?: number;
  investmentScore?: number;
  liquidityScore?: LiquidityTier;
  outlierFlag?: boolean;
  screenerSignal?: ScreenerSignal;
  signalExplainer?: string[];
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
