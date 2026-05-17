#!/usr/bin/env node
import crypto from "node:crypto";
import OAuth from "oauth-1.0a";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["BRICKLINK_CONSUMER_KEY","BRICKLINK_CONSUMER_SECRET","BRICKLINK_TOKEN_VALUE","BRICKLINK_TOKEN_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[bl-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const oauth = OAuth({
  consumer: { key: process.env.BRICKLINK_CONSUMER_KEY, secret: process.env.BRICKLINK_CONSUMER_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base, key) { return crypto.createHmac("sha1", key).update(base).digest("base64"); },
});
const token = { key: process.env.BRICKLINK_TOKEN_VALUE, secret: process.env.BRICKLINK_TOKEN_SECRET };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function blFetch(url) {
  const req = { url, method: "GET" };
  const auth = oauth.toHeader(oauth.authorize(req, token));
  const res = await fetch(url, { headers: { ...auth, Accept: "application/json" } });
  if (res.status === 429) { await sleep(3000); return blFetch(url); }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();
  if (json.meta && json.meta.code >= 400) throw new Error(`BL API ${json.meta.code}: ${json.meta.message}`);
  return json.data;
}

async function loadAllSetNums() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item.id);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function fetchPriceGuide(setNum, condition) {
  const url = `https://api.bricklink.com/api/store/v1/items/SET/${setNum}-1/price?guide_type=sold&new_or_used=${condition}`;
  return blFetch(url);
}

async function syncOne(setNum) {
  const nowIso = new Date().toISOString();
  const yyyyMm = nowIso.slice(0, 7);
  const items = [];
  for (const cond of ["N", "U"]) {
    const guide = await fetchPriceGuide(setNum, cond).catch((e) => { console.warn(`[bl-sync] ${setNum} ${cond}: ${e.message}`); return null; });
    if (!guide) continue;
    const condLabel = cond === "N" ? "new" : "used";
    items.push({
      pk: `HISTORY#PRODUCT#${setNum}`,
      sk: `bricklink-${condLabel}#${yyyyMm}`,
      source: `bricklink-${condLabel}`,
      avgPrice: Number(guide.avg_price) || null,
      minPrice: Number(guide.min_price) || null,
      maxPrice: Number(guide.max_price) || null,
      qtyAvgPrice: Number(guide.qty_avg_price) || null,
      unitQuantity: guide.unit_quantity ?? null,
      totalQuantity: guide.total_quantity ?? null,
      capturedAt: nowIso,
    });
  }
  if (items.length) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: items.map((Item) => ({ PutRequest: { Item } })) } }));
  }
  const newItem = items.find((i) => i.source === "bricklink-new");
  const usedItem = items.find((i) => i.source === "bricklink-used");
  if (newItem || usedItem) {
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: [{ PutRequest: { Item: {
        pk: `PRICING#PRODUCT#${setNum}`,
        sk: "bricklink",
        newAvg: newItem?.avgPrice ?? null,
        usedAvg: usedItem?.avgPrice ?? null,
        capturedAt: nowIso,
      } } }] },
    }));
  }
}

async function main() {
  const setNums = await loadAllSetNums();
  console.log(`[bl-sync] ${setNums.length} sets to refresh`);
  let i = 0;
  for (const setNum of setNums) {
    await syncOne(setNum);
    i++;
    if (i % 100 === 0) console.log(`[bl-sync] ${i}/${setNums.length}`);
    await sleep(200);
  }
  console.log(`[bl-sync] done: ${i} sets refreshed`);
}

main().catch((err) => { console.error(err); process.exit(1); });
