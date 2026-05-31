import { describe, it, expect } from "vitest";
import {
  computeLiquidityScore,
  computeEstimatedNetGain,
  detectOutlier,
  computeInvestmentScore,
  assignInvestmentUniverse,
  deriveScreenerSignal,
  buildSignalExplainer,
} from "./lego-investment-score";

describe("computeLiquidityScore", () => {
  it("High when salesVolume >= 20", () => expect(computeLiquidityScore(25)).toBe("High"));
  it("Medium when salesVolume 5-19", () => expect(computeLiquidityScore(10)).toBe("Medium"));
  it("Low when salesVolume 1-4", () => expect(computeLiquidityScore(3)).toBe("Low"));
  it("Insufficient when 0 or null", () => {
    expect(computeLiquidityScore(0)).toBe("Insufficient");
    expect(computeLiquidityScore(null)).toBe("Insufficient");
  });
});

describe("computeEstimatedNetGain", () => {
  it("deducts BrickLink fees, packaging, damage reserve, and shipping", () => {
    // projectedValue=200, currentPrice=100, pieceCount=500 (medium → $15 shipping)
    // bricklink: 3% of 200 = 6.00
    // payment: 2.9% of 200 + 0.30 = 5.80 + 0.30 = 6.10
    // packaging: 3.00
    // damage reserve: 3% of 200 = 6.00
    // shipping (medium 300-999): 15.00
    // netGain = 200 - 100 - 6.00 - 6.10 - 3.00 - 6.00 - 15.00 = 63.90
    const result = computeEstimatedNetGain(200, 100, 500);
    expect(result).toBeCloseTo(63.9, 0);
  });
  it("small set ships cheaper than large", () => {
    const small = computeEstimatedNetGain(100, 50, 100);
    const large = computeEstimatedNetGain(100, 50, 1500);
    expect(small).toBeGreaterThan(large);
  });
  it("can return negative when costs exceed gain", () => {
    expect(computeEstimatedNetGain(55, 50, 500)).toBeLessThan(0);
  });
});

describe("detectOutlier", () => {
  it("flags price > 20x MSRP with low volume", () => {
    expect(detectOutlier(307000, 10, 1)).toBe(true);
  });
  it("flags price > 20x MSRP with no volume data", () => {
    expect(detectOutlier(5000, 20, null)).toBe(true);
  });
  it("does not flag a legitimately appreciated premium set", () => {
    expect(detectOutlier(1200, 849, 30)).toBe(false);
  });
  it("does not flag a set trading 10x msrp with good liquidity", () => {
    expect(detectOutlier(300, 30, 5)).toBe(false);
  });
  it("does not flag when MSRP is 0 (GWP)", () => {
    expect(detectOutlier(500, 0, null)).toBe(false);
  });
});

describe("computeInvestmentScore", () => {
  it("retiring-soon set with high confidence + high liquidity scores > 70", () => {
    const score = computeInvestmentScore({
      annualRate: 0.12,
      dollarGain: 250,
      confidence: "high",
      liquidityScore: "High",
      retiringSoon: true,
      retired: false,
      retirementYear: null,
      originalMsrp: 200,
      currentPrice: 180,
    });
    expect(score).toBeGreaterThan(70);
  });
  it("active set with low confidence + insufficient liquidity + no retirement scores < 35", () => {
    const score = computeInvestmentScore({
      annualRate: 0.02,
      dollarGain: 10,
      confidence: "low",
      liquidityScore: "Insufficient",
      retiringSoon: false,
      retired: false,
      retirementYear: null,
      originalMsrp: 30,
      currentPrice: 30,
    });
    expect(score).toBeLessThan(35);
  });
  it("score is clamped 0–100", () => {
    const score = computeInvestmentScore({
      annualRate: 0.5,
      dollarGain: 10000,
      confidence: "high",
      liquidityScore: "High",
      retiringSoon: true,
      retired: false,
      retirementYear: null,
      originalMsrp: 100,
      currentPrice: 90,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("assignInvestmentUniverse", () => {
  it("DataIssue when outlierFlag is true", () => {
    expect(assignInvestmentUniverse("Boxed Set", false, true, true)).toBe("DataIssue");
  });
  it("DataIssue when no pricing data", () => {
    expect(assignInvestmentUniverse("Boxed Set", false, false, false)).toBe("DataIssue");
  });
  it("CollectorCatalog for non-boxed-set product types", () => {
    expect(assignInvestmentUniverse("Keychain", false, false, true)).toBe("CollectorCatalog");
    expect(assignInvestmentUniverse("Polybag", false, false, true)).toBe("CollectorCatalog");
    expect(assignInvestmentUniverse("Plush", false, false, true)).toBe("CollectorCatalog");
    expect(assignInvestmentUniverse("Book", false, false, true)).toBe("CollectorCatalog");
  });
  it("RetiredTracker for retired boxed set with pricing", () => {
    expect(assignInvestmentUniverse("Boxed Set", true, false, true)).toBe("RetiredTracker");
  });
  it("InvestableSet for active boxed set with pricing", () => {
    expect(assignInvestmentUniverse("Boxed Set", false, false, true)).toBe("InvestableSet");
  });
});

describe("deriveScreenerSignal", () => {
  it("Strong Buy: score >= 80, High/Medium liquidity, netGain >= 40", () => {
    expect(deriveScreenerSignal(85, "High", 50, false, "InvestableSet")).toBe("Strong Buy");
    expect(deriveScreenerSignal(82, "Medium", 45, false, "InvestableSet")).toBe("Strong Buy");
  });
  it("Buy: score >= 70, non-Insufficient liquidity, netGain >= 25", () => {
    expect(deriveScreenerSignal(72, "Medium", 30, false, "InvestableSet")).toBe("Buy");
    expect(deriveScreenerSignal(70, "Low", 25, false, "InvestableSet")).toBe("Buy");
  });
  it("Watch: score 50–69", () => {
    expect(deriveScreenerSignal(55, "Low", 10, false, "InvestableSet")).toBe("Watch");
    expect(deriveScreenerSignal(50, "Insufficient", 0, false, "InvestableSet")).toBe("Watch");
  });
  it("Avoid: score < 50", () => {
    expect(deriveScreenerSignal(40, "Low", -5, false, "InvestableSet")).toBe("Avoid");
  });
  it("Avoid when outlierFlag is true regardless of score", () => {
    expect(deriveScreenerSignal(90, "High", 100, true, "InvestableSet")).toBe("Avoid");
  });
  it("DataIssue propagates from universe", () => {
    expect(deriveScreenerSignal(90, "High", 100, false, "DataIssue")).toBe("DataIssue");
  });
});

describe("buildSignalExplainer", () => {
  it("includes retirement and net gain for Buy signal", () => {
    const lines = buildSignalExplainer({
      screenerSignal: "Buy",
      retiringSoon: true,
      retired: false,
      theme: "Star Wars",
      liquidityScore: "Medium",
      salesVolume: 12,
      currentPrice: 180,
      originalMsrp: 200,
      estimatedNetGain: 46,
      annualRate: 0.10,
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => /retiring/i.test(l))).toBe(true);
    expect(lines.some((l) => /net gain/i.test(l))).toBe(true);
  });
  it("returns empty array for Avoid and DataIssue", () => {
    const avoid = buildSignalExplainer({
      screenerSignal: "Avoid",
      retiringSoon: false,
      retired: false,
      theme: "City",
      liquidityScore: "Insufficient",
      salesVolume: null,
      currentPrice: 30,
      originalMsrp: 30,
      estimatedNetGain: -5,
      annualRate: 0.01,
    });
    expect(avoid).toEqual([]);

    const di = buildSignalExplainer({
      screenerSignal: "DataIssue",
      retiringSoon: false,
      retired: false,
      theme: "City",
      liquidityScore: "Insufficient",
      salesVolume: null,
      currentPrice: 0,
      originalMsrp: 0,
      estimatedNetGain: 0,
      annualRate: 0,
    });
    expect(di).toEqual([]);
  });
  it("capped at 4 lines", () => {
    const lines = buildSignalExplainer({
      screenerSignal: "Strong Buy",
      retiringSoon: true,
      retired: false,
      theme: "Star Wars",
      liquidityScore: "High",
      salesVolume: 30,
      currentPrice: 90,
      originalMsrp: 100,
      estimatedNetGain: 80,
      annualRate: 0.15,
    });
    expect(lines.length).toBeLessThanOrEqual(4);
  });
});
