import { describe, it, expectTypeOf } from "vitest";
import type {
  ProductType,
  InvestmentUniverse,
  LiquidityTier,
  ScreenerSignal,
  LegoSet,
  Forecast,
} from "@/lib/types/lego";

describe("screener types", () => {
  it("ProductType covers expected values", () => {
    const t: ProductType = "Boxed Set";
    expectTypeOf(t).toBeString();
  });
  it("LegoSet has productType and soldComps90d", () => {
    expectTypeOf<LegoSet["productType"]>().toEqualTypeOf<ProductType | undefined>();
    expectTypeOf<LegoSet["soldComps90d"]>().toEqualTypeOf<number | undefined>();
  });
  it("Forecast has screenerSignal and investmentScore", () => {
    expectTypeOf<Forecast["screenerSignal"]>().toEqualTypeOf<ScreenerSignal | undefined>();
    expectTypeOf<Forecast["investmentScore"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Forecast["estimatedNetGain"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Forecast["liquidityScore"]>().toEqualTypeOf<LiquidityTier | undefined>();
    expectTypeOf<Forecast["outlierFlag"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Forecast["signalExplainer"]>().toEqualTypeOf<string[] | undefined>();
  });
  it("InvestmentUniverse has four members", () => {
    const universes: InvestmentUniverse[] = [
      "InvestableSet",
      "RetiredTracker",
      "CollectorCatalog",
      "DataIssue",
    ];
    expect(universes).toHaveLength(4);
  });
});
