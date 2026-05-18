import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { synthesizeBaselinePrice } from "@/lib/domain/lego-baseline";
import type { PricingBaseline } from "@/lib/domain/lego-baseline";

const FULL_BASELINE: PricingBaseline = {
  version: 1,
  builtAt: "2026-01-01T00:00:00Z",
  sampleCount: 1000,
  themeCount: 3,
  globalDollarsPerPiece: 0.105,
  retiredDollarsPerPiece: 0.16,
  currentDollarsPerPiece: 0.1,
  themes: {
    "Star Wars": {
      retired: { dollarsPerPiece: 0.22, sampleCount: 80 },
      current: { dollarsPerPiece: 0.13, sampleCount: 120 },
      any: { dollarsPerPiece: 0.16, sampleCount: 200 },
    },
    Technic: {
      any: { dollarsPerPiece: 0.14, sampleCount: 50 },
    },
    Friends: {
      current: { dollarsPerPiece: 0.09, sampleCount: 30 },
    },
  },
};

const product = (overrides: Partial<{ pieceCount: number; theme: string; retired: boolean }> = {}) => ({
  pieceCount: 1000,
  theme: "Star Wars" as never,
  retired: false,
  ...overrides,
});

describe("synthesizeBaselinePrice", () => {
  it("returns null when baseline is missing", () => {
    expect(synthesizeBaselinePrice(product(), null)).toBeNull();
  });

  it("returns null when pieceCount is missing or zero", () => {
    expect(synthesizeBaselinePrice(product({ pieceCount: 0 }), FULL_BASELINE)).toBeNull();
    expect(synthesizeBaselinePrice(product({ pieceCount: NaN }), FULL_BASELINE)).toBeNull();
  });

  it("uses exact (theme × retired) bucket when available", () => {
    // Star Wars retired = $0.22/piece × 1000 = $220
    const price = synthesizeBaselinePrice(
      product({ theme: "Star Wars" as never, retired: true, pieceCount: 1000 }),
      FULL_BASELINE
    );
    expect(price).toBe(220);
  });

  it("uses exact (theme × current) bucket when available", () => {
    // Star Wars current = $0.13/piece × 500 = $65
    const price = synthesizeBaselinePrice(
      product({ theme: "Star Wars" as never, retired: false, pieceCount: 500 }),
      FULL_BASELINE
    );
    expect(price).toBe(65);
  });

  it("falls back to per-theme 'any' bucket when status-specific is missing", () => {
    // Technic only has .any = $0.14, regardless of retired flag
    const retired = synthesizeBaselinePrice(
      product({ theme: "Technic" as never, retired: true, pieceCount: 1000 }),
      FULL_BASELINE
    );
    const current = synthesizeBaselinePrice(
      product({ theme: "Technic" as never, retired: false, pieceCount: 1000 }),
      FULL_BASELINE
    );
    expect(retired).toBe(140);
    expect(current).toBe(140);
  });

  it("falls back to status-only global when theme is unknown", () => {
    // Unknown theme + retired → retiredDollarsPerPiece = $0.16
    const price = synthesizeBaselinePrice(
      product({ theme: "Unknown" as never, retired: true, pieceCount: 1000 }),
      FULL_BASELINE
    );
    expect(price).toBe(160);
  });

  it("falls back to global median when no bucket and no status median", () => {
    const partial: PricingBaseline = {
      ...FULL_BASELINE,
      themes: {},
      retiredDollarsPerPiece: null,
      currentDollarsPerPiece: null,
    };
    const price = synthesizeBaselinePrice(
      product({ theme: "Unknown" as never, retired: false, pieceCount: 1000 }),
      partial
    );
    expect(price).toBe(105); // 1000 × 0.105
  });

  it("returns null when even the global median is missing", () => {
    const empty: PricingBaseline = {
      ...FULL_BASELINE,
      themes: {},
      globalDollarsPerPiece: null,
      retiredDollarsPerPiece: null,
      currentDollarsPerPiece: null,
    };
    expect(synthesizeBaselinePrice(product(), empty)).toBeNull();
  });

  it("rounds to nearest cent", () => {
    // 333 × 0.13 = 43.29
    const price = synthesizeBaselinePrice(
      product({ theme: "Star Wars" as never, retired: false, pieceCount: 333 }),
      FULL_BASELINE
    );
    expect(price).toBe(43.29);
  });

  it("prefers theme-status bucket over theme.any when both exist", () => {
    // Star Wars has both .current ($0.13) and .any ($0.16); current must win
    const price = synthesizeBaselinePrice(
      product({ theme: "Star Wars" as never, retired: false, pieceCount: 100 }),
      FULL_BASELINE
    );
    expect(price).toBe(13); // 100 × 0.13, not 100 × 0.16
  });
});
