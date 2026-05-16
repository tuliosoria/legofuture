import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/sealed-search";
import {
  fetchLivePricing,
  getPricingFromDdb,
} from "@/lib/domain/sealed-estimate";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "sealed-pricing-ip",
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

  const live = await fetchLivePricing(product);
  const stored = await getPricingFromDdb(id);
  const pricing = live ?? stored;

  if (!pricing) {
    return NextResponse.json({ error: "Pricing not available" }, { status: 404 });
  }

  return NextResponse.json({ id, pricing, source: live ? "live" : "ddb" });
}
