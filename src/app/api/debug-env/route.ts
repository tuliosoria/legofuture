import { NextResponse } from "next/server";
import { getDynamo, getTableName } from "@/lib/db/dynamo";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
  let ddbProbe: string;
  let queryProbe: string;
  try {
    const c = getDynamo();
    const t = getTableName();
    ddbProbe = `client=${c ? "ok" : "null"} table=${t || "null"}`;
    if (c && t) {
      const res = await c.send(
        new QueryCommand({
          TableName: t,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": "CATALOG" },
          Limit: 1,
        })
      );
      queryProbe = `count=${res.Count} sample=${JSON.stringify(res.Items?.[0])?.slice(0, 200)}`;
    } else {
      queryProbe = "skipped";
    }
  } catch (err) {
    queryProbe = `ERR: ${(err as Error).name}: ${(err as Error).message}`;
    ddbProbe = ddbProbe! ?? "n/a";
  }
  return NextResponse.json({
    hasDdb: Boolean(process.env.DYNAMODB_TABLE),
    region: process.env.AWS_REGION || "missing",
    ddbProbe: ddbProbe!,
    queryProbe,
  });
}
