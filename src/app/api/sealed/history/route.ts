import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/sealed-search";
import { getPricing } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";
import type { HistoryPoint } from "@/lib/types/sealed";

export const dynamic = "force-dynamic";

/**
 * Synthetic monthly price history derived from current price + assumed
 * momentum. Real PriceCharting historical data will replace this later.
 */
export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "sealed-history-ip",
    windowSec: 60,
    max: 120,
  });
  if (blocked) return blocked;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const product = await getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const pricing = await getPricing(product);
  const forecast = computeForecast(product, pricing);
  const currentPrice = forecast.currentPrice;

  const months = 24;
  const monthlyRate = Math.pow(1 + forecast.annualRate, 1 / 12) - 1;
  const history: HistoryPoint[] = [];

  const now = new Date();
  for (let m = months; m >= 0; m--) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - m);
    history.push({
      date: d.toISOString().slice(0, 10),
      price: Math.round(currentPrice / Math.pow(1 + monthlyRate, m)),
    });
  }

  return NextResponse.json({
    id,
    history,
    note: "Synthetic history — real historical data will be available in a future update.",
  });
}
