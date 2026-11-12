import { vi, describe, it, expect } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/lego-forecast-models", () => ({
  loadForecastModel: vi.fn(),
}));

import { computeForecast } from "@/lib/domain/lego-forecast";
import type { LegoSet, ProductPricing } from "@/lib/types/lego";

const makeSet = (overrides: Partial<LegoSet> = {}): LegoSet => ({
  id: "75192",
  setNumber: "75192",
  name: "Millennium Falcon",
  theme: "Star Wars",
  releaseYear: 2017,
  retired: false,
  retiringSoon: true,
  pieceCount: 7541,
  minifigCount: 9,
  originalMsrp: 849,
  imageUrl: "",
  slug: "millennium-falcon",
  productType: "Boxed Set",
  ...overrides,
});

const makePricing = (newPrice: number, salesVolume = 25): ProductPricing => ({
  newPrice,
  cibPrice: null,
  loosePrice: null,
  salesVolume,
  lastFetched: "2024-01-01",
});

describe("computeForecast investment fields", () => {
  it("populates investmentScore as number 0–100", () => {
    const f = computeForecast(makeSet(), makePricing(800), null);
    expect(typeof f.investmentScore).toBe("number");
    expect(f.investmentScore).toBeGreaterThanOrEqual(0);
    expect(f.investmentScore).toBeLessThanOrEqual(100);
  });
  it("populates estimatedNetGain as number", () => {
    const f = computeForecast(makeSet(), makePricing(800), null);
    expect(typeof f.estimatedNetGain).toBe("number");
  });
  it("liquidityScore = High when salesVolume = 25", () => {
    const f = computeForecast(makeSet(), makePricing(800, 25), null);
    expect(f.liquidityScore).toBe("High");
  });
  it("liquidityScore = Insufficient when salesVolume = 0", () => {
    const f = computeForecast(makeSet(), makePricing(800, 0), null);
    expect(f.liquidityScore).toBe("Insufficient");
  });
  it("prefers soldComps90d over salesVolume for liquidity when available", () => {
    const setWithComps = makeSet({ soldComps90d: 2 });
    const f = computeForecast(setWithComps, makePricing(800, 100), null);
    // soldComps90d=2 → Low (overrides salesVolume=100 which would give High)
    expect(f.liquidityScore).toBe("Low");
  });
  it("outlierFlag is true for extreme price relative to MSRP", () => {
    const f = computeForecast(
      makeSet({ originalMsrp: 10 }),
      makePricing(500000, 1),
      null
    );
    expect(f.outlierFlag).toBe(true);
  });
  it("outlierFlag is false for normal prices", () => {
    const f = computeForecast(makeSet(), makePricing(800), null);
    expect(f.outlierFlag).toBe(false);
  });
  it("screenerSignal is a valid ScreenerSignal", () => {
    const f = computeForecast(makeSet(), makePricing(800), null);
    expect(["Strong Buy", "Buy", "Watch", "Avoid", "DataIssue"]).toContain(
      f.screenerSignal
    );
  });
  it("signalExplainer is an array of strings", () => {
    const f = computeForecast(makeSet(), makePricing(800), null);
    expect(Array.isArray(f.signalExplainer)).toBe(true);
    if (f.signalExplainer) {
      for (const line of f.signalExplainer) {
        expect(typeof line).toBe("string");
      }
    }
  });
  it("too_new stub includes safe defaults for new fields", () => {
    const newSet = makeSet({ releaseYear: new Date().getFullYear() });
    const f = computeForecast(newSet, makePricing(100), null);
    expect(f.status).toBe("too_new");
    expect(f.screenerSignal).toBe("Watch");
    expect(f.investmentScore).toBe(0);
    expect(f.outlierFlag).toBe(false);
    expect(Array.isArray(f.signalExplainer)).toBe(true);
  });
});
