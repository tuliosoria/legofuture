#!/usr/bin/env node
import crypto from "node:crypto";
import OAuth from "oauth-1.0a";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["BRICKLINK_CONSUMER_KEY","BRICKLINK_CONSUMER_SECRET","BRICKLINK_TOKEN_VALUE","BRICKLINK_TOKEN_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[bl-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const RATE_LIMIT_MS = Number(process.env.BRICKLINK_RATE_LIMIT_MS || 1100);
const PROGRESS_KEY = { pk: "META#BRICKLINK_PROGRESS", sk: "v1" };
const PROGRESS_FLUSH_EVERY = 25;
const RESUME = process.env.BRICKLINK_RESUME !== "false"; // default true

const oauth = OAuth({
  consumer: { key: process.env.BRICKLINK_CONSUMER_KEY, secret: process.env.BRICKLINK_CONSUMER_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base, key) { return crypto.createHmac("sha1", key).update(base).digest("base64"); },
});
const token = { key: process.env.BRICKLINK_TOKEN_VALUE, secret: process.env.BRICKLINK_TOKEN_SECRET };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function blFetch(url, attempt = 0) {
  const req = { url, method: "GET" };
  const auth = oauth.toHeader(oauth.authorize(req, token));
  const res = await fetch(url, { headers: { ...auth, Accept: "application/json" } });
  if (res.status === 429) {
    const backoff = Math.min(60000, 5000 * Math.pow(2, attempt));
    console.warn(`[bl-sync] 429 — backoff ${backoff}ms (attempt ${attempt + 1})`);
    await sleep(backoff);
    if (attempt < 4) return blFetch(url, attempt + 1);
    throw new Error(`429 too many retries for ${url}`);
  }
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
      FilterExpression: "begins_with(pk, :p) AND sk = :sk AND attribute_exists(setNumber)",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "setNumber",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) if (item.setNumber) out.push(String(item.setNumber));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  // Sort for deterministic resume order
  return Array.from(new Set(out)).sort();
}

async function loadProgress() {
  if (!RESUME) return { lastProcessed: null, processedCount: 0 };
  try {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: PROGRESS_KEY }));
    return {
      lastProcessed: res.Item?.lastProcessed ?? null,
      processedCount: res.Item?.processedCount ?? 0,
    };
  } catch { return { lastProcessed: null, processedCount: 0 }; }
}

async function saveProgress(lastProcessed, processedCount) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...PROGRESS_KEY, lastProcessed, processedCount, updatedAt: new Date().toISOString() },
  }));
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
  console.log(`[bl-sync] ${setNums.length} sets eligible (have setNumber)`);
  const { lastProcessed, processedCount: priorCount } = await loadProgress();
  let startIdx = 0;
  if (lastProcessed) {
    const found = setNums.indexOf(lastProcessed);
    if (found >= 0) {
      startIdx = found + 1;
      console.log(`[bl-sync] resuming after ${lastProcessed} (idx=${startIdx}, prior=${priorCount})`);
    }
  }
  let i = startIdx;
  const t0 = Date.now();
  for (; i < setNums.length; i++) {
    const setNum = setNums[i];
    try {
      await syncOne(setNum);
    } catch (e) {
      console.warn(`[bl-sync] ${setNum}: ${e.message}`);
    }
    if ((i + 1) % PROGRESS_FLUSH_EVERY === 0) {
      await saveProgress(setNum, i + 1);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(`[bl-sync] ${i + 1}/${setNums.length} (last=${setNum}, ${elapsed}s elapsed)`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  await saveProgress(setNums[setNums.length - 1] ?? null, i);
  console.log(`[bl-sync] DONE: processed ${i - startIdx} sets in ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => { console.error(err); process.exit(1); });
