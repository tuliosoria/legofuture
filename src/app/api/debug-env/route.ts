import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    keys: Object.keys(process.env).sort(),
    hasDdb: Boolean(process.env.DYNAMODB_TABLE),
    ddb: process.env.DYNAMODB_TABLE ? "set" : "missing",
    region: process.env.AWS_REGION || "missing",
    hasPriceCharting: Boolean(process.env.PRICECHARTING_API_TOKEN),
  });
}
