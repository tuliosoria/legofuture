import { NextRequest, NextResponse } from "next/server";
const googleTrends = require("google-trends-api"); // required: no ESM types available

export async function GET(request: NextRequest) {
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
