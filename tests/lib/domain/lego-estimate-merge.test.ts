import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mergePricingRows } from "@/lib/domain/lego-estimate";

describe("mergePricingRows", () => {
  it("returns null when no rows contribute prices", () => {
    expect(mergePricingRows([]).pricing).toBeNull();
    expect(mergePricingRows([]).providerCount).toBe(0);
  });

  it("merges PriceCharting row (cents → dollars)", () => {
    const result = mergePricingRows([
      {
        sk: "v1",
        "new-price": 12345,
        "cib-price": 9000,
        "loose-price": 4500,
        updatedAt: "2026-05-01T00:00:00Z",
      },
    ]);
    expect(result.pricing).toEqual({
      newPrice: 123.45,
      cibPrice: 90,
      loosePrice: 45,
      salesVolume: null,
      lastFetched: "2026-05-01T00:00:00Z",
    });
    expect(result.providerCount).toBe(1);
  });

  it("falls back to BrickLink when PC is absent", () => {
    const result = mergePricingRows([
      { sk: "bricklink", newAvg: 99.5, usedAvg: 60, capturedAt: "2026-05-02T00:00:00Z" },
    ]);
    expect(result.pricing?.newPrice).toBe(99.5);
    expect(result.pricing?.cibPrice).toBe(60);
    expect(result.providerCount).toBe(2); // bricklink-new + bricklink-used
  });

  it("PC newPrice wins over BrickLink newAvg (precedence)", () => {
    const result = mergePricingRows([
      { sk: "v1", "new-price": 12000, updatedAt: "2026-05-01T00:00:00Z" },
      { sk: "bricklink", newAvg: 999, usedAvg: 50, capturedAt: "2026-05-02T00:00:00Z" },
    ]);
    expect(result.pricing?.newPrice).toBe(120); // PC wins, not 999
    expect(result.pricing?.cibPrice).toBe(50); // PC had no cib → BL-used fills
    // sources: pricecharting + bricklink-new + bricklink-used = 3
    expect(result.providerCount).toBe(3);
  });

  it("Brickset fills gaps when PC and BL silent", () => {
    const result = mergePricingRows([
      { sk: "brickset", currentValueNew: 80, currentValueUsed: 40, capturedAt: "2026-05-03T00:00:00Z" },
    ]);
    expect(result.pricing?.newPrice).toBe(80);
    expect(result.pricing?.cibPrice).toBe(40);
    expect(result.providerCount).toBe(1);
  });

  it("eBay last-resort + populates salesVolume", () => {
    const result = mergePricingRows([
      { sk: "ebay-sold", avgSoldPrice: 70, soldCount: 12, capturedAt: "2026-05-04T00:00:00Z" },
    ]);
    expect(result.pricing?.newPrice).toBe(70);
    expect(result.pricing?.salesVolume).toBe(12);
    expect(result.providerCount).toBe(1);
  });

  it("counts distinct providers across all four sources", () => {
    const result = mergePricingRows([
      { sk: "v1", "new-price": 10000 },
      { sk: "bricklink", newAvg: 50 },
      { sk: "brickset", currentValueNew: 90 },
      { sk: "ebay-sold", avgSoldPrice: 80 },
    ]);
    expect(result.providerCount).toBe(4);
    expect(result.pricing?.newPrice).toBe(100); // PC wins
  });

  it("ignores zero/null/string-NaN inputs", () => {
    const result = mergePricingRows([
      { sk: "v1", "new-price": null, "cib-price": "abc", "loose-price": 0 },
    ]);
    // 0 is finite → counted; "abc" → ignored; null → ignored
    expect(result.pricing?.loosePrice).toBe(0);
    expect(result.pricing?.newPrice).toBeNull();
    expect(result.pricing?.cibPrice).toBeNull();
  });
});
