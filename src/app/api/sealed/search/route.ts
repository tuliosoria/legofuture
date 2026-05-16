import { NextRequest, NextResponse } from "next/server";
import { loadStoredCatalog } from "@/lib/db/sealed-search";
import { getPricing } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";
import type { LegoTheme } from "@/lib/types/sealed";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.toLowerCase().trim() ?? "";
  const theme = searchParams.get("theme") as LegoTheme | null;
  const recommendation = searchParams.get("recommendation");
  const scenario = searchParams.get("scenario");
  const status = searchParams.get("status"); // "retired" | "current"
  const sort = searchParams.get("sort") ?? "roi";

  let catalog = await loadStoredCatalog();

  // Free-text search
  if (q) {
    catalog = catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.setNumber.includes(q) ||
        p.theme.toLowerCase().includes(q) ||
        (p.subtheme ?? "").toLowerCase().includes(q)
    );
  }

  // Theme filter
  if (theme) {
    catalog = catalog.filter((p) => p.theme === theme);
  }

  // Status filter
  if (status === "retired") catalog = catalog.filter((p) => p.retired);
  if (status === "current") catalog = catalog.filter((p) => !p.retired);

  // Build forecasts (needed for recommendation / sort)
  const withForecasts = await Promise.all(
    catalog.map(async (product) => {
      const pricing = await getPricing(product);
      const forecast = computeForecast(product, pricing);
      return { product, forecast };
    })
  );

  // Recommendation filter
  let filtered = withForecasts;
  if (recommendation) {
    filtered = withForecasts.filter(({ forecast }) => {
      const signal = forecast.signal.toLowerCase();
      return signal === recommendation.toLowerCase();
    });
  }

  // Sort
  const scenarioKey = (scenario ?? "moderate") as "pessimist" | "moderate" | "optimist";
  filtered.sort((a, b) => {
    const fa = a.forecast.scenarios[scenarioKey] ?? a.forecast;
    const fb = b.forecast.scenarios[scenarioKey] ?? b.forecast;
    switch (sort) {
      case "price":
        return (fb.projectedValue ?? 0) - (fa.projectedValue ?? 0);
      case "signal":
        return (fb.annualRate ?? 0) - (fa.annualRate ?? 0);
      case "roi":
      default:
        return (fb.roiPercent ?? 0) - (fa.roiPercent ?? 0);
    }
  });

  return NextResponse.json({
    results: filtered.map(({ product, forecast }) => ({
      product,
      forecast: scenario ? forecast.scenarios[scenarioKey] : forecast,
    })),
    total: filtered.length,
  });
}
