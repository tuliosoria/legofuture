import { describe, expect, it } from "vitest";
import { MAX_SCORE_SHIFT, adjustForCurrentPrice, impliedCagr } from "./price-adjusted-score";

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
  it("leaves score and signal alone when the price did not move", () => {
    expect(adjustForCurrentPrice(curated, 380)).toEqual({ score: 90, signal: "Buy" });
  });

  it("lowers the score when today's price eats into the curated projected upside", () => {
    // 760/380 → 14.9% CAGR; 760/500 → 8.7%: −6.2pp × 35% × (100/30) ≈ −7
    expect(adjustForCurrentPrice(curated, 500)).toEqual({ score: 83, signal: "Buy" });
  });

  it("raises the score when the price drops", () => {
    expect(adjustForCurrentPrice(curated, 300).score).toBe(96);
  });

  it("never moves the score by more than MAX_SCORE_SHIFT points, nor past 0–100", () => {
    expect(MAX_SCORE_SHIFT).toBe(10);
    expect(adjustForCurrentPrice(curated, 100).score).toBe(100);
    expect(adjustForCurrentPrice({ ...curated, score: 70 }, 100).score).toBe(80);
    expect(adjustForCurrentPrice({ ...curated, score: 70 }, 2000).score).toBe(60);
  });

  it("downgrades Buy to Watch under 6% CAGR and anything to Hold under 2%", () => {
    expect(adjustForCurrentPrice(curated, 600).signal).toBe("Watch");
    expect(adjustForCurrentPrice(curated, 720).signal).toBe("Hold");
    expect(adjustForCurrentPrice({ ...curated, signal: "Watch" }, 600).signal).toBe("Watch");
  });

  it("falls back to the curated values when a price or projection is missing", () => {
    expect(adjustForCurrentPrice(curated, 0)).toEqual({ score: 90, signal: "Buy" });
    expect(adjustForCurrentPrice({ ...curated, currentPrice: 0 }, 500)).toEqual({ score: 90, signal: "Buy" });
  });
});
