import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/db/sealed-search";
import { bricklinkUrlForSetNumber } from "@/lib/domain/sealed-bricklink";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const product = await getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const url = bricklinkUrlForSetNumber(product.setNumber);
  return NextResponse.json({ id, setNumber: product.setNumber, url });
}
