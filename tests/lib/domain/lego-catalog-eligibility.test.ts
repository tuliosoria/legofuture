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
  it("eligible when ≥1 pricing source", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 1 })).toBe(true);
    expect(isEligibleForDashboard({ pricingProviderCount: 3 })).toBe(true);
  });
  it("ineligible when zero pricing sources", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 0 })).toBe(false);
    expect(isEligibleForDashboard({})).toBe(false);
  });
});
