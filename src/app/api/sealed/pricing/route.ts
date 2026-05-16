import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/sealed-search";
import { fetchLivePricing, getPricingFromBundle } from "@/lib/domain/sealed-estimate";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const product = getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Try live pricing first; fall back to bundle
  const live = await fetchLivePricing(product);
  const bundle = getPricingFromBundle(id);
  const pricing = live ?? bundle;

  if (!pricing) {
    return NextResponse.json({ error: "Pricing not available" }, { status: 404 });
  }

  return NextResponse.json({ id, pricing, source: live ? "live" : "bundle" });
}
