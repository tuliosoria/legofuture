import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, getProductById } from "@/lib/db/lego-search";
import { forecastForSet } from "@/lib/domain/lego-forecast";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";


export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "set-forecast-ip",
    windowSec: 60,
    max: 120,
  });
  if (blocked) return blocked;

  const slug = request.nextUrl.searchParams.get("slug");
  const id = request.nextUrl.searchParams.get("id");
  if (!slug && !id) {
    return NextResponse.json(
      { error: "Missing slug parameter" },
      { status: 400 }
    );
  }

  const product = slug
    ? await getProductBySlug(slug)
    : await getProductById(id!);
  if (!product) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const forecast = forecastForSet(product, null, []);

  return NextResponse.json(forecast, {
    headers: {
      "Cache-Control": "public, max-age=300",

    },
  });
}
