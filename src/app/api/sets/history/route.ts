import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, getProductById } from "@/lib/db/lego-search";
import { loadHistory } from "@/lib/db/lego-history";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";
import type { LegoCondition } from "@/lib/types/lego";

export const dynamic = "force-dynamic";

const VALID_CONDITIONS: ReadonlyArray<LegoCondition> = [
  "new-sealed",
  "complete",
  "loose",
];

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "set-history-ip",
    windowSec: 60,
    max: 120,
  });
  if (blocked) return blocked;

  const slug = request.nextUrl.searchParams.get("slug");
  const id = request.nextUrl.searchParams.get("id");
  const conditionRaw = (request.nextUrl.searchParams.get("condition") ??
    "new-sealed") as LegoCondition;
  const condition: LegoCondition = VALID_CONDITIONS.includes(conditionRaw)
    ? conditionRaw
    : "new-sealed";

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

  const history = await loadHistory(product, condition);

  return NextResponse.json(history, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Data-Freshness": new Date().toISOString(),
    },
  });
}
