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

describe("sunset investment publication", () => {
 it.each([0,2,25,100])("legacy soldComps90d=%s never creates liquidity or recommendation", count=>expect(computeForecast(makeSet({soldComps90d:count}),makePricing(800,100),null)).toBeNull());
 it("MSRP and missing pricing never produce forecast",()=>expect(computeForecast(makeSet(),null,null)).toBeNull());
 it("an extreme legacy price is unavailable rather than clamped into an estimate",()=>expect(computeForecast(makeSet(),makePricing(500000),null)).toBeNull());
});
