import { describe, expect, it } from "vitest";
import {
  agreementDots,
  annualRoiLabel,
  brickLinkImageUrl,
  brickLinkUrl,
  cagr5,
  communityDots,
  ebayUrl,
  liquidityDots,
  outlookDots,
  retirementDots,
  roiPercent,
  scenarioRoi,
  SP500_ANNUAL,
} from "@/lib/domain/forecast";

const sample = {
  id: "sample",
  name: "Sample Set",
  setNumber: "12345",
  theme: "Sample",
  productType: "Sample",
  year: 2020,
  status: "Retired" as const,
  msrp: 100,
  currentPrice: 100,
  proj5y: 200,
  bear: 150,
  bull: 280,
  score: 80,
  signal: "Buy" as const,
  confidence: 4 as const,
  confLabel: "High" as const,
  pieces: 1000,
  communityScore: 78,
  momentum: "+18% 12mo",
  liquidity: "High · 200+ listings",
  priceAgreement: "92%",
  thesis: "test",
};

describe("forecast helpers", () => {
  it("roiPercent computes total return", () => {
    expect(roiPercent(sample)).toBeCloseTo(100, 5);
  });

  it("roiPercent handles zero currentPrice safely", () => {
    expect(roiPercent({ currentPrice: 0, proj5y: 100 })).toBe(0);
  });

  it("cagr5 ≈ 14.87% for doubling over 5yr", () => {
    expect(cagr5(sample) * 100).toBeCloseTo(14.87, 1);
  });

  it("annualRoiLabel renders with sign", () => {
    expect(annualRoiLabel(sample)).toBe("+14.9%/yr");
  });

  it("outlookDots scales with CAGR", () => {
    expect(outlookDots({ currentPrice: 100, proj5y: 300 })).toBe(5); // 24.6%/yr
    expect(outlookDots({ currentPrice: 100, proj5y: 100 })).toBe(2); // 0%
    expect(outlookDots({ currentPrice: 100, proj5y: 90 })).toBe(1); // negative
  });

  it("retirementDots favours Retired", () => {
    expect(retirementDots({ status: "Retired" })).toBe(5);
    expect(retirementDots({ status: "Retiring soon" })).toBe(4);
    expect(retirementDots({ status: "Active" })).toBe(2);
  });

  it("communityDots buckets correctly", () => {
    expect(communityDots({ communityScore: 90 })).toBe(5);
    expect(communityDots({ communityScore: 78 })).toBe(4);
    expect(communityDots({ communityScore: 67 })).toBe(3);
    expect(communityDots({ communityScore: 55 })).toBe(2);
    expect(communityDots({ communityScore: 30 })).toBe(1);
  });

  it("liquidityDots maps tier", () => {
    expect(liquidityDots({ liquidity: "High · 200+ listings" })).toBe(5);
    expect(liquidityDots({ liquidity: "Medium · 90+ listings" })).toBe(3);
    expect(liquidityDots({ liquidity: "Low · 20+ listings" })).toBe(2);
  });

  it("agreementDots parses percent", () => {
    expect(agreementDots({ priceAgreement: "95%" })).toBe(5);
    expect(agreementDots({ priceAgreement: "88%" })).toBe(4);
    expect(agreementDots({ priceAgreement: "82%" })).toBe(3);
    expect(agreementDots({ priceAgreement: "75%" })).toBe(2);
    expect(agreementDots({ priceAgreement: "60%" })).toBe(1);
  });

  it("scenarioRoi computes per-scenario return", () => {
    expect(scenarioRoi(100, 250)).toBe(150);
    expect(scenarioRoi(100, 50)).toBe(-50);
    expect(scenarioRoi(0, 100)).toBe(0);
  });

  it("SP500_ANNUAL is 10.5%", () => {
    expect(SP500_ANNUAL).toBeCloseTo(0.105, 5);
  });

  it("ebayUrl includes set number and name", () => {
    const u = ebayUrl({ name: "Bookshop", setNumber: "10270" });
    expect(u).toContain("10270");
    expect(u).toMatch(/Bookshop/i);
  });

  it("brickLinkUrl points to catalog item page", () => {
    expect(brickLinkUrl({ setNumber: "10270" })).toBe(
      "https://www.bricklink.com/v2/catalog/catalogitem.page?S=10270-1",
    );
  });

  it("brickLinkImageUrl returns predictable CDN url", () => {
    expect(brickLinkImageUrl({ setNumber: "10270" })).toBe(
      "https://img.bricklink.com/ItemImage/SN/0/10270-1.png",
    );
  });
});
