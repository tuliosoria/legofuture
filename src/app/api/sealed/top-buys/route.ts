import { NextResponse } from "next/server";
import { loadStoredCatalog } from "@/lib/db/sealed-search";
import { getPricing } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";

export async function GET() {
  const catalog = await loadStoredCatalog();

  const withForecasts = await Promise.all(
    catalog.map(async (product) => {
      const pricing = await getPricing(product);
      const forecast = computeForecast(product, pricing);
      return { product, forecast };
    })
  );

  const topBuys = withForecasts
    .filter(({ forecast }) => forecast.status === "ready" && forecast.signal === "Buy")
    .sort((a, b) => b.forecast.roiPercent - a.forecast.roiPercent)
    .slice(0, 10);

  return NextResponse.json({ topBuys });
}
