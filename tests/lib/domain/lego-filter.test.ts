import { describe, it, expect } from "vitest";
import { runFilterPipeline, DEFAULT_FILTER_STATE, isDefaultState } from "@/lib/domain/lego-filter";
import type { CatalogItem, FilterState } from "@/lib/domain/lego-filter";
import type { LegoSet, Forecast, InvestmentUniverse } from "@/lib/types/lego";

const makeItem = (overrides: {
  universe?: InvestmentUniverse;
  signal?: Forecast["screenerSignal"];
  score?: number;
  liquidityScore?: Forecast["liquidityScore"];
  estimatedNetGain?: number;
  retired?: boolean;
  id?: string;
} = {}): CatalogItem => ({
  product: {
    id: overrides.id ?? "1",
    setNumber: overrides.id ?? "1",
    name: "Test Set",
    theme: "City",
    releaseYear: 2022,
    retired: overrides.retired ?? false,
    retiringSoon: false,
    pieceCount: 200,
    minifigCount: 0,
    originalMsrp: 50,
    imageUrl: "",
    slug: "test-set",
    productType: "Boxed Set",
    investmentUniverse: overrides.universe ?? "InvestableSet",
  },
  forecast: {
    id: overrides.id ?? "1",
    currentPrice: 50,
    projectedValue: 100,
    dollarGain: 50,
    roiPercent: 100,
    annualRate: 0.15,
    signal: "Buy",
    confidence: "high",
    status: "ready",
    statusMessage: null,
    predictionSpreadPercent: 20,
    scenarios: {
      pessimist: { projectedValue: 80, dollarGain: 30, roiPercent: 60, annualRate: 0.10, signal: "Buy" as const },
      moderate: { projectedValue: 100, dollarGain: 50, roiPercent: 100, annualRate: 0.15, signal: "Buy" as const },
      optimist: { projectedValue: 130, dollarGain: 80, roiPercent: 160, annualRate: 0.21, signal: "Buy" as const },
    },
    screenerSignal: overrides.signal ?? "Buy",
    investmentScore: overrides.score ?? 75,
    liquidityScore: overrides.liquidityScore ?? "High",
    estimatedNetGain: overrides.estimatedNetGain ?? 40,
    outlierFlag: false,
    signalExplainer: [],
  },
});

describe("runFilterPipeline with pageMode", () => {
  it("Investment Screener includes only InvestableSet items", () => {
    const items = [
      makeItem({ universe: "InvestableSet", id: "1" }),
      makeItem({ universe: "CollectorCatalog", id: "2" }),
      makeItem({ universe: "DataIssue", id: "3" }),
      makeItem({ universe: "RetiredTracker", id: "4" }),
    ];
    const result = runFilterPipeline(items, { ...DEFAULT_FILTER_STATE, pageMode: "Investment Screener" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].product.id).toBe("1");
  });

  it("Retired Set Tracker shows only RetiredTracker items", () => {
    const items = [
      makeItem({ universe: "InvestableSet", id: "1" }),
      makeItem({ universe: "RetiredTracker", id: "2", retired: true }),
    ];
    const result = runFilterPipeline(items, {
      ...DEFAULT_FILTER_STATE,
      pageMode: "Retired Set Tracker",
      status: "all",
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].product.id).toBe("2");
  });

  it("Collector Catalog shows only CollectorCatalog items", () => {
    const items = [
      makeItem({ universe: "InvestableSet", id: "1" }),
      makeItem({ universe: "CollectorCatalog", id: "2" }),
    ];
    const result = runFilterPipeline(items, {
      ...DEFAULT_FILTER_STATE,
      pageMode: "Collector Catalog",
      status: "all",
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].product.id).toBe("2");
  });

  it("sorts by investmentScore descending when sort=investmentScore", () => {
    const items = [
      makeItem({ score: 60, id: "1" }),
      makeItem({ score: 90, id: "2" }),
      makeItem({ score: 75, id: "3" }),
    ];
    const result = runFilterPipeline(items, { ...DEFAULT_FILTER_STATE, sort: "investmentScore" });
    const scores = result.results.map((i) => i.forecast.investmentScore ?? 0);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });

  it("filters by liquidityTier", () => {
    const items = [
      makeItem({ liquidityScore: "High", id: "1" }),
      makeItem({ liquidityScore: "Low", id: "2" }),
    ];
    const result = runFilterPipeline(items, { ...DEFAULT_FILTER_STATE, liquidityTier: "High" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].product.id).toBe("1");
  });

  it("filters by minNetGain", () => {
    const items = [
      makeItem({ estimatedNetGain: 50, id: "1" }),
      makeItem({ estimatedNetGain: 10, id: "2" }),
    ];
    const result = runFilterPipeline(items, { ...DEFAULT_FILTER_STATE, minNetGain: 30 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].product.id).toBe("1");
  });

  it("filters by screenerSignalFilter", () => {
    const items = [
      makeItem({ signal: "Strong Buy", id: "1" }),
      makeItem({ signal: "Watch", id: "2" }),
    ];
    const result = runFilterPipeline(items, { ...DEFAULT_FILTER_STATE, screenerSignalFilter: "Strong Buy" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].product.id).toBe("1");
  });
});

describe("isDefaultState", () => {
  it("returns true for DEFAULT_FILTER_STATE", () => {
    expect(isDefaultState(DEFAULT_FILTER_STATE)).toBe(true);
  });

  it("returns false when any new field differs", () => {
    expect(isDefaultState({ ...DEFAULT_FILTER_STATE, pageMode: "Retired Set Tracker" })).toBe(false);
    expect(isDefaultState({ ...DEFAULT_FILTER_STATE, screenerSignalFilter: "Buy" })).toBe(false);
    expect(isDefaultState({ ...DEFAULT_FILTER_STATE, liquidityTier: "High" })).toBe(false);
    expect(isDefaultState({ ...DEFAULT_FILTER_STATE, minNetGain: 10 })).toBe(false);
    expect(isDefaultState({ ...DEFAULT_FILTER_STATE, sort: "gain" })).toBe(false);
  });
});
