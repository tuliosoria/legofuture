import { describe, it, expect } from "vitest";
import * as policy from "../../scripts/lib/ebay-price-policy.mjs";

const listing = (id = "v1|123|0", currency = "USD", value = "100") => ({
  itemId: id, title: "LEGO 75192 new sealed", conditionId: "1000", buyingOptions: ["FIXED_PRICE"], price: { value, currency },
});

describe("summarizeListings", () => {
  it("deduplicates variations of the same eBay item before counting", () => {
    expect(policy.summarizeListings([listing(), listing(), listing("v1|123|1")], "75192", 100)).toEqual({ activeCount: 1, p50: 100 });
  });
  it("requires identity, exact currency, new condition and fixed price", () => {
    expect(policy.summarizeListings([
      listing(""), listing("b", "EUR"), listing("c", ""),
      { ...listing("d"), conditionId: "3000" },
      { ...listing("e"), buyingOptions: ["AUCTION"] },
      listing("f", "USD", "NaN"), listing("g", "USD", "0"), listing("h", "USD", ""),
    ], "75192", 100)).toBeNull();
  });
  it("uses eight unique valid observations, not raw items", () => {
    const items = Array.from({length: 8}, (_, i) => listing(`v1|${i}|0`));
    expect(policy.decideEbayPrice({lastKnown: 100, aggregate: policy.summarizeListings(items, "75192", 100)}).status).toBe("accepted");
    expect(policy.decideEbayPrice({lastKnown: 100, aggregate: policy.summarizeListings(Array(8).fill(listing()), "75192", 100)}).status).toBe("thin");
  });
});

describe("price observation provenance", () => {
  const now = "2026-11-12T07:00:00Z";
  const result = {setNumber: "75192", status: "thin", price: 100, activeCount: 2, p50: 100};
  it("does not label a legacy fallback as a new eBay price", () => {
    const row = policy.buildPriceRow(result, undefined, now);
    expect(row).not.toHaveProperty("price");
    expect(row).not.toHaveProperty("source");
    expect(row).not.toHaveProperty("capturedAt");
    expect(row.checkedAt).toBe(now);
  });
  it("keeps the prior accepted price and observation time on rejection", () => {
    const row = policy.buildPriceRow(result, {price: 95, source: "ebay", capturedAt: "2026-11-01T07:00:00Z"}, now);
    expect(row).toMatchObject({price: 95, source: "ebay", capturedAt: "2026-11-01T07:00:00Z", checkedAt: now});
  });
  it("refreshes the observation time for accepted unchanged prices", () => {
    expect(policy.buildPriceRow({...result, status: "accepted", activeCount: 8}, {price: 100, capturedAt: "2026-11-01T07:00:00Z"}, now)).toMatchObject({price: 100, capturedAt: now, source: "ebay"});
  });
});
