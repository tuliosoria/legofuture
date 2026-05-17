import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/lego-search";
import { getPricing } from "@/lib/domain/lego-estimate";
import { computeForecast } from "@/lib/domain/lego-forecast";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "set-forecast-ip",
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

  return NextResponse.json({ product, forecast, pricing });
}
