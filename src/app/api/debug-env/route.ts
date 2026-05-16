import { NextResponse } from "next/server";
import { getDynamo, getTableName } from "@/lib/db/dynamo";

export const dynamic = "force-dynamic";

export async function GET() {
  let ddbProbe: string;
  try {
    const c = getDynamo();
    const t = getTableName();
    ddbProbe = `client=${c ? "ok" : "null"} table=${t || "null"}`;
  } catch (err) {
    ddbProbe = `ERR: ${(err as Error).message}`;
  }
  return NextResponse.json({
    hasDdb: Boolean(process.env.DYNAMODB_TABLE),
    ddb: process.env.DYNAMODB_TABLE ? "set" : "missing",
    region: process.env.AWS_REGION || "missing",
    hasPriceCharting: Boolean(process.env.PRICECHARTING_API_TOKEN),
    ddbProbe,
  });
}
