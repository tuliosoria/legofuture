#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[ebay-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const RATE_LIMIT_MS = Number(process.env.EBAY_RATE_LIMIT_MS || 700);
const PROGRESS_KEY = { pk: "META#EBAY_PROGRESS", sk: "v1" };
const PROGRESS_FLUSH_EVERY = 25;
const RESUME = process.env.EBAY_RESUME !== "false";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cachedToken = null;
async function getAccessToken(force = false) {
  if (cachedToken && !force) return cachedToken;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) throw new Error(`eBay token HTTP ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  return cachedToken;
}

async function searchSold(setNum, attempt = 0) {
  const token = await getAccessToken();
  const q = encodeURIComponent(`LEGO ${setNum}`);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&limit=50&filter=buyingOptions:{FIXED_PRICE}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && attempt < 1) { await getAccessToken(true); return searchSold(setNum, attempt + 1); }
  if (res.status === 429) {
    const backoff = Math.min(60000, 5000 * Math.pow(2, attempt));
    console.warn(`[ebay-sync] 429 — backoff ${backoff}ms`);
    await sleep(backoff);
    if (attempt < 4) return searchSold(setNum, attempt + 1);
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  const prices = (data.itemSummaries || [])
    .map((i) => Number(i.price?.value))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return { medianPrice: median, avgPrice: avg, count: prices.length, minPrice: prices[0], maxPrice: prices[prices.length - 1] };
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
  return Array.from(new Set(out)).sort();
}

async function loadProgress() {
  if (!RESUME) return { lastProcessed: null };
  try {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: PROGRESS_KEY }));
    return { lastProcessed: res.Item?.lastProcessed ?? null };
  } catch { return { lastProcessed: null }; }
}

async function saveProgress(lastProcessed, processedCount) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...PROGRESS_KEY, lastProcessed, processedCount, updatedAt: new Date().toISOString() },
  }));
}

async function main() {
  await getAccessToken();
  const setNums = await loadAllSetNums();
  console.log(`[ebay-sync] ${setNums.length} sets to query`);
  const { lastProcessed } = await loadProgress();
  let startIdx = 0;
  if (lastProcessed) {
    const found = setNums.indexOf(lastProcessed);
    if (found >= 0) { startIdx = found + 1; console.log(`[ebay-sync] resuming after ${lastProcessed} (idx=${startIdx})`); }
  }
  const nowIso = new Date().toISOString();
  const yyyyMm = nowIso.slice(0, 7);
  const t0 = Date.now();
  let i = startIdx;
  for (; i < setNums.length; i++) {
    const setNum = setNums[i];
    const agg = await searchSold(setNum).catch((e) => { console.warn(`[ebay-sync] ${setNum}: ${e.message}`); return null; });
    if (agg) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: [
          { PutRequest: { Item: {
            pk: `HISTORY#PRODUCT#${setNum}`,
            sk: `ebay-sold#${yyyyMm}`,
            source: "ebay",
            medianPrice: agg.medianPrice,
            avgPrice: agg.avgPrice,
            minPrice: agg.minPrice,
            maxPrice: agg.maxPrice,
            count: agg.count,
            capturedAt: nowIso,
          } } },
          { PutRequest: { Item: {
            pk: `PRICING#PRODUCT#${setNum}`,
            sk: "ebay-sold",
            source: "ebay",
            avgSoldPrice: agg.avgPrice,
            medianSoldPrice: agg.medianPrice,
            soldCount: agg.count,
            minPrice: agg.minPrice,
            maxPrice: agg.maxPrice,
            capturedAt: nowIso,
          } } },
        ] },
      }));
    }
    if ((i + 1) % PROGRESS_FLUSH_EVERY === 0) {
      await saveProgress(setNum, i + 1);
      console.log(`[ebay-sync] ${i + 1}/${setNums.length} (last=${setNum}, ${Math.round((Date.now() - t0) / 1000)}s elapsed)`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  await saveProgress(setNums[setNums.length - 1] ?? null, i);
  console.log(`[ebay-sync] DONE: processed ${i - startIdx} sets in ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => { console.error(err); process.exit(1); });
