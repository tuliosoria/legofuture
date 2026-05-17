#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[ebay-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken() {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) throw new Error(`eBay token HTTP ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function searchSold(token, setNum) {
  // Note: Browse API returns ACTIVE listings, not sold. True sold data needs
  // Marketplace Insights API approval. Using Browse as approximation.
  const q = encodeURIComponent(`LEGO ${setNum}`);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&limit=50&filter=buyingOptions:{FIXED_PRICE}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) { await sleep(2000); return searchSold(token, setNum); }
  if (!res.ok) return null;
  const data = await res.json();
  const prices = (data.itemSummaries || [])
    .map((i) => Number(i.price?.value))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  return {
    medianPrice: prices[Math.floor(prices.length / 2)],
    count: prices.length,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
  };
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

async function main() {
  const token = await getAccessToken();
  const setNums = await loadAllSetNums();
  console.log(`[ebay-sync] ${setNums.length} sets to query`);
  const nowIso = new Date().toISOString();
  const yyyyMm = nowIso.slice(0, 7);
  let i = 0;
  for (const setNum of setNums) {
    const agg = await searchSold(token, setNum);
    if (agg) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: [{ PutRequest: { Item: {
          pk: `HISTORY#PRODUCT#${setNum}`,
          sk: `ebay#${yyyyMm}`,
          source: "ebay",
          medianPrice: agg.medianPrice,
          minPrice: agg.minPrice,
          maxPrice: agg.maxPrice,
          count: agg.count,
          capturedAt: nowIso,
        } } }] },
      }));
    }
    i++;
    if (i % 100 === 0) console.log(`[ebay-sync] ${i}/${setNums.length}`);
    await sleep(700);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
