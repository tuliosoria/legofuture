import { describe, expect, it } from "vitest";
import { adjustForCurrentPrice, impliedCagr } from "./price-adjusted-score";

const curated = { score: 90, signal: "Buy" as const, currentPrice: 380, proj5y: 760 };

describe("impliedCagr", () => {
  it("is the 5-year compound growth from price to projection", () => {
    expect(impliedCagr(100, 200)).toBeCloseTo(0.1487, 4);
    expect(impliedCagr(0, 200)).toBeNull();
    expect(impliedCagr(100, 0)).toBeNull();
    expect(impliedCagr(Number.NaN, 200)).toBeNull();
  });
});

describe("adjustForCurrentPrice", () => {
  it("leaves score and signal alone when the price and projection did not move", () => {
    expect(adjustForCurrentPrice(curated, { currentPrice: 380, proj5y: 760 })).toEqual({ score: 90, signal: "Buy" });
  });

  it("lowers the score when today's price eats into the projected upside", () => {
    // 760/380 → 14.9% CAGR; 760/500 → 8.7%: −6.2pp × 35% × (100/30) ≈ −7
    expect(adjustForCurrentPrice(curated, { currentPrice: 500, proj5y: 760 })).toEqual({ score: 83, signal: "Buy" });
  });

  it("raises the score when the price drops, capped at 100", () => {
    expect(adjustForCurrentPrice(curated, { currentPrice: 300, proj5y: 760 }).score).toBe(96);
    expect(adjustForCurrentPrice(curated, { currentPrice: 100, proj5y: 760 }).score).toBe(100);
  });

  it("downgrades Buy to Watch under 6% CAGR and anything to Hold under 2%", () => {
    expect(adjustForCurrentPrice(curated, { currentPrice: 600, proj5y: 760 }).signal).toBe("Watch");
    expect(adjustForCurrentPrice(curated, { currentPrice: 720, proj5y: 760 }).signal).toBe("Hold");
    expect(adjustForCurrentPrice({ ...curated, signal: "Watch" }, { currentPrice: 600, proj5y: 760 }).signal).toBe("Watch");
  });

  it("falls back to the curated values when either CAGR is undefined", () => {
    expect(adjustForCurrentPrice(curated, { currentPrice: 0, proj5y: 760 })).toEqual({ score: 90, signal: "Buy" });
    expect(adjustForCurrentPrice({ ...curated, currentPrice: 0 }, { currentPrice: 500, proj5y: 760 })).toEqual({ score: 90, signal: "Buy" });
  });
});
