import { describe, it, expect } from "vitest";
import { isEligibleForDashboard, countPricingProviders } from "@/lib/domain/lego-catalog-eligibility";

describe("countPricingProviders", () => {
  it("counts non-null pricing sources", () => {
    expect(countPricingProviders({ pricecharting: { current: 100 } })).toBe(1);
    expect(countPricingProviders({ pricecharting: { current: 100 }, bricklink: { newAvg: 95 } })).toBe(2);
    expect(countPricingProviders({})).toBe(0);
    expect(countPricingProviders({ pricecharting: null })).toBe(0);
  });
});

describe("isEligibleForDashboard", () => {
  it("eligible when ≥1 pricing source and meaningful set size", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 1, pieceCount: 100 })).toBe(true);
    expect(isEligibleForDashboard({ pricingProviderCount: 3, originalMsrp: 30 })).toBe(true);
    expect(isEligibleForDashboard({ pricingProviderCount: 1, pieceCount: 30 })).toBe(true);
    expect(isEligibleForDashboard({ pricingProviderCount: 1, originalMsrp: 15 })).toBe(true);
  });
  it("ineligible when zero pricing sources", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 0, pieceCount: 100 })).toBe(false);
    expect(isEligibleForDashboard({})).toBe(false);
  });
  it("ineligible when pricing source present but no meaningful set size (merchandise/gear)", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 1, pieceCount: 0, originalMsrp: 0 })).toBe(false);
    expect(isEligibleForDashboard({ pricingProviderCount: 1, pieceCount: 5, originalMsrp: 8 })).toBe(false);
  });
});
