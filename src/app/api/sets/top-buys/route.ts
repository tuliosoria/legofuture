import { NextRequest, NextResponse } from "next/server";
import { loadStoredCatalog } from "@/lib/db/lego-search";
import { getPricing } from "@/lib/domain/lego-estimate";
import { forecastForSet } from "@/lib/domain/lego-forecast";
import { loadHistory } from "@/lib/db/lego-history";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "set-topbuys-ip",
    windowSec: 60,
    max: 120,
  });
  if (blocked) return blocked;

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;

  const catalog = await loadStoredCatalog();

  const scored = await Promise.all(
    catalog.map(async (product) => {
      const [pricing, history] = await Promise.all([
        getPricing(product),
        loadHistory(product, "new-sealed"),
      ]);
      const forecast = forecastForSet(product, pricing, history);
      return { product, forecast };
    })
  );

  const topBuys = scored
    .filter(
      ({ forecast }) =>
        forecast.forecastEligible && forecast.recommendation === "buy"
    )
    .sort(
      (a, b) =>
        b.forecast.scenarios.moderate.cagr - a.forecast.scenarios.moderate.cagr
    )
    .slice(0, limit);

  return NextResponse.json(
    { items: topBuys, updatedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Data-Freshness": new Date().toISOString(),
      },
    }
  );
}
