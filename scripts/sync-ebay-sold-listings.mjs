#!/usr/bin/env node
import "./lib/ebay-browse-disabled.mjs";
import { assertOAuthResponse, isTerminalEbayError } from "./lib/ebay-response.mjs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { aggregateAskingListings, askingRows } from "./lib/ebay-observation.mjs";

const VERIFIED_LIMIT = Number(process.env.EBAY_VERIFIED_DAILY_LIMIT);
if (!Number.isSafeInteger(VERIFIED_LIMIT) || VERIFIED_LIMIT <= 0) throw new Error("missing-config: verified eBay quota required");
let browseCalls = 0;
const REQUIRED = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[ebay-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const RATE_LIMIT_MS = Number(process.env.EBAY_RATE_LIMIT_MS || 700);
const PROGRESS_KEY = { pk: "META#EBAY_ASKING_PROGRESS", sk: "v1" };
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
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  assertOAuthResponse(res);
  const data = await res.json();
  cachedToken = data.access_token;
  return cachedToken;
}

async function searchAsking(setNum, attempt = 0) {
  const token = await getAccessToken();
  const q = encodeURIComponent(`LEGO ${setNum}`);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&limit=50&filter=buyingOptions:{FIXED_PRICE}`;
  if (++browseCalls > VERIFIED_LIMIT) throw new Error("quota: app budget exhausted");
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 && attempt < 1) { await getAccessToken(true); return searchAsking(setNum, attempt + 1); }
  if (res.status === 429) throw new Error("quota: stop job; preserve previous observations");
  if (res.status === 401 || res.status === 403) throw new Error("auth: stop job");
  if (!res.ok) return null;
  const data = await res.json();
  return aggregateAskingListings(data.itemSummaries || [], setNum);
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
  const t0 = Date.now();
  let i = startIdx;
  for (; i < setNums.length; i++) {
    const setNum = setNums[i];
    const agg = await searchAsking(setNum).catch((e) => { console.warn(`[ebay-sync] ${setNum}: ${e.message}`); if (isTerminalEbayError(e)) throw e; return null; });
    if (agg) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: [
          ...askingRows(setNum, agg, new Date().toISOString()).map(Item => ({ PutRequest: { Item } })),
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
