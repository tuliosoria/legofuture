import type { LegoSet, LegoTheme, Forecast, Scenario, LiquidityTier, ScreenerSignal } from "@/lib/types/lego";
import { buildLegoDisplayName, buildLegoSearchAliases } from "./lego-catalog-search";

export type StatusFilter = "all" | "active" | "retiring" | "retired";
export type RecommendationFilter = "all" | "buy" | "hold" | "sell";
export type ScreenerSignalFilter = "all" | "Strong Buy" | "Buy" | "Watch" | "Avoid";
export type PageMode = "Investment Screener" | "Retired Set Tracker" | "Collector Catalog";
export type SortKey =
  | "gain"
  | "upside"
  | "price-asc"
  | "price-desc"
  | "confidence"
  | "pieces-asc"
  | "pieces-desc"
  | "retirement"
  | "investmentScore";

export interface CatalogItem {
  product: LegoSet;
  forecast: Forecast;
}

export interface FilterState {
  query: string;
  themes: LegoTheme[];
  status: StatusFilter;
  recommendation: RecommendationFilter;
  scenario: Scenario;
  sort: SortKey;
  pageMode: PageMode;
  screenerSignalFilter: ScreenerSignalFilter;
  liquidityTier: "all" | LiquidityTier;
  minNetGain: number;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  query: "",
  themes: [],
  status: "active",
  recommendation: "all",
  scenario: "moderate",
  sort: "investmentScore",
  pageMode: "Investment Screener",
  screenerSignalFilter: "all",
  liquidityTier: "all",
  minNetGain: 0,
};

export function matchesStatus(set: LegoSet, status: StatusFilter): boolean {
  switch (status) {
    case "active":
      return !set.retired;
    case "retiring":
      return !set.retired && set.retiringSoon === true;
    case "retired":
      return set.retired === true;
    case "all":
    default:
      return true;
  }
}

export function matchesRecommendation(
  forecast: Forecast,
  rec: RecommendationFilter
): boolean {
  if (rec === "all") return true;
  return forecast.signal.toLowerCase() === rec;
}

export function matchesFreeText(set: LegoSet, freeText: string): boolean {
  if (!freeText) return true;
  const needle = freeText.toLowerCase();
  const display = buildLegoDisplayName(set).toLowerCase();
  const sub = (set.subtheme ?? "").toLowerCase();
  const theme = set.theme.toLowerCase();
  const num = set.setNumber.toLowerCase();
  return (
    display.includes(needle) ||
    sub.includes(needle) ||
    theme.includes(needle) ||
    num.includes(needle)
  );
}

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function sortItems(
  items: CatalogItem[],
  sort: SortKey,
  scenario: Scenario
): CatalogItem[] {
  const scenarioOf = (f: Forecast) => f.scenarios[scenario] ?? f;
  return [...items].sort((a, b) => {
    const fa = scenarioOf(a.forecast);
    const fb = scenarioOf(b.forecast);
    switch (sort) {
      case "price-asc":
        return a.forecast.currentPrice - b.forecast.currentPrice;
      case "price-desc":
        return b.forecast.currentPrice - a.forecast.currentPrice;
      case "confidence":
        return (
          (CONFIDENCE_RANK[b.forecast.confidence] ?? 0) -
          (CONFIDENCE_RANK[a.forecast.confidence] ?? 0)
        );
      case "pieces-asc":
        return (a.product.pieceCount ?? 0) - (b.product.pieceCount ?? 0);
      case "pieces-desc":
        return (b.product.pieceCount ?? 0) - (a.product.pieceCount ?? 0);
      case "retirement": {
        const ay = a.product.retirementYear ?? Number.POSITIVE_INFINITY;
        const by = b.product.retirementYear ?? Number.POSITIVE_INFINITY;
        return ay - by;
      }
      case "gain":
        return (fb.dollarGain ?? 0) - (fa.dollarGain ?? 0);
      case "investmentScore":
        return (b.forecast.investmentScore ?? 0) - (a.forecast.investmentScore ?? 0);
      case "upside":
      default:
        return (fb.roiPercent ?? 0) - (fa.roiPercent ?? 0);
    }
  });
}

export interface FilterPipelineResult {
  /** Final filtered + sorted items */
  results: CatalogItem[];
  /** Items after status + recommendation + search, BEFORE theme filter (for facet counts) */
  preThemeResults: CatalogItem[];
  /** Aliases parsed from the query (if any) */
  aliases: ReturnType<typeof buildLegoSearchAliases>;
}

/**
 * Standard faceted-search pipeline. Theme counts are derived from
 * `preThemeResults` so the user can always see how many sets each
 * theme would add to the current selection.
 */
export function runFilterPipeline(
  items: CatalogItem[],
  state: FilterState
): FilterPipelineResult {
  const aliases = buildLegoSearchAliases(state.query);
  const effectiveStatus: StatusFilter =
    state.status !== "all"
      ? state.status
      : aliases.status === "retired"
        ? "retired"
        : aliases.status === "active"
          ? "active"
          : aliases.status === "retiring"
            ? "retiring"
            : "all";
  const effectiveThemes: LegoTheme[] =
    state.themes.length > 0
      ? state.themes
      : aliases.theme
        ? [aliases.theme]
        : [];

  const universeFilter: string[] | null = (() => {
    switch (state.pageMode) {
      case "Investment Screener": return ["InvestableSet"];
      case "Retired Set Tracker": return ["RetiredTracker"];
      case "Collector Catalog": return ["CollectorCatalog"];
      default: return null;
    }
  })();

  const preTheme = items.filter(({ product, forecast }) => {
    if (universeFilter && !universeFilter.includes(product.investmentUniverse ?? "DataIssue")) return false;
    if (!matchesStatus(product, effectiveStatus)) return false;
    if (!matchesRecommendation(forecast, state.recommendation)) return false;
    if (!matchesFreeText(product, aliases.freeText)) return false;
    if (state.liquidityTier !== "all" && forecast.liquidityScore !== state.liquidityTier) return false;
    if (state.minNetGain > 0 && (forecast.estimatedNetGain ?? 0) < state.minNetGain) return false;
    if (state.screenerSignalFilter !== "all" && forecast.screenerSignal !== state.screenerSignalFilter) return false;
    return true;
  });

  const filtered =
    effectiveThemes.length === 0
      ? preTheme
      : preTheme.filter(({ product }) => effectiveThemes.includes(product.theme));

  const results = sortItems(filtered, state.sort, state.scenario);
  return { results, preThemeResults: preTheme, aliases };
}

export function isDefaultState(state: FilterState): boolean {
  return (
    state.query === "" &&
    state.themes.length === 0 &&
    state.status === "active" &&
    state.recommendation === "all" &&
    state.scenario === "moderate" &&
    state.sort === "investmentScore" &&
    state.pageMode === "Investment Screener" &&
    state.screenerSignalFilter === "all" &&
    state.liquidityTier === "all" &&
    state.minNetGain === 0
  );
}
