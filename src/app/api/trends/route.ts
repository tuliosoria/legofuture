import { NextRequest, NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";
const googleTrends = require("google-trends-api");

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "trends-ip",
    windowSec: 60,
    max: 30,
  });
  if (blocked) return blocked;

  const theme = request.nextUrl.searchParams.get("theme") ?? "LEGO";
  const keyword = `LEGO ${theme}`;

  try {
    const results: string = await googleTrends.interestOverTime({
      keyword,
      startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    });
    const parsed = JSON.parse(results);
    const timeline = (parsed?.default?.timelineData ?? []).map(
      (d: { formattedAxisTime: string; value?: number[] }) => ({
        date: d.formattedAxisTime,
        value: d.value?.[0] ?? 0,
      })
    );
    return NextResponse.json({ keyword, timeline });
  } catch {
    return NextResponse.json(
      { keyword, timeline: [], error: "Google Trends unavailable" },
      { status: 200 }
    );
  }
}
