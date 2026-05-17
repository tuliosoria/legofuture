import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, getProductById } from "@/lib/db/lego-search";
import {
  isValidSetMarketplaceUrl,
  resolveBricklinkSetUrl,
} from "@/lib/domain/lego-bricklink";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  const url = resolveBricklinkSetUrl(product.setNumber);
  const isSetPage = url !== null && isValidSetMarketplaceUrl(url);

  return NextResponse.json(
    { url, isSetPage },
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "X-Data-Freshness": new Date().toISOString(),
      },
    }
  );
}
