import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "legofuture",
    readiness: {
      valuation: "unavailable",
      ebay: process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && Number.isSafeInteger(Number(process.env.EBAY_VERIFIED_DAILY_LIMIT)) && Number(process.env.EBAY_VERIFIED_DAILY_LIMIT)>0
        ? {status:"unknown",reason:"not-probed"}
        : {status:"unavailable",reason:"missing-config"},
    },
  });
}
