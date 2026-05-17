#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { writeFile, mkdir } from "node:fs/promises";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const LIMIT = Number(process.env.SMOKE_LIMIT || 50);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });

async function randomSets() {
  const all = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id, pricingProviderCount",
      ExclusiveStartKey,
    }));
    for (const i of res.Items || []) all.push(i);
    ExclusiveStartKey = res.LastEvaluatedKey;
    if (all.length >= LIMIT * 5) break;
  } while (ExclusiveStartKey);
  return all.sort(() => Math.random() - 0.5).slice(0, LIMIT);
}

async function describeSet(setNum) {
  const out = { setNum, sources: {} };
  for (const [name, pk] of [
    ["catalog", `CATALOG#PRODUCT#${setNum}`],
    ["pricing", `PRICING#PRODUCT#${setNum}`],
    ["history", `HISTORY#PRODUCT#${setNum}`],
    ["community", `COMMUNITY#PRODUCT#${setNum}`],
  ]) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      Limit: 5,
    }));
    out.sources[name] = (res.Items || []).length;
  }
  return out;
}

async function main() {
  await mkdir("tmp", { recursive: true });
  const sets = await randomSets();
  const report = [];
  for (const s of sets) report.push(await describeSet(s.id));
  await writeFile("tmp/smoke-report.json", JSON.stringify(report, null, 2));
  const complete = report.filter((r) => r.sources.catalog && r.sources.pricing).length;
  console.log(`[smoke] ${complete}/${report.length} sets have catalog+pricing rows`);
  console.log(`[smoke] report → tmp/smoke-report.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
