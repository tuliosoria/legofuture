import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/sealed-search";
import { getPricing } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const product = getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const pricing = await getPricing(product);
  const forecast = computeForecast(product, pricing);

  return NextResponse.json({ product, forecast, pricing });
}
