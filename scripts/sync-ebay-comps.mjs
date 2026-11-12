#!/usr/bin/env node
/**
 * Fetches eBay active-listing counts per LEGO set and writes soldComps90d
 * to each CATALOG#PRODUCT# DDB row so the catalog Scan picks it up
 * at no extra read cost during page load.
 *
 * Uses the eBay Browse API (same OAuth flow as sync-ebay-sold-listings.mjs).
 * Run: node --env-file=.env.local scripts/sync-ebay-comps.mjs [--limit=100]
 *
 * Required env vars: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`[ebay-comps] FATAL: ${k} is required`);
    process.exit(1);
  }
}

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const RATE_LIMIT_MS = Number(process.env.EBAY_RATE_LIMIT_MS || 500);

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let _token = null;
async function getToken(force = false) {
  if (_token && !force) return _token;
  const basic = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) throw new Error(`eBay token HTTP ${res.status}`);
  const data = await res.json();
  _token = data.access_token;
  return _token;
}

async function fetchListingCount(setNumber, attempt = 0) {
  const token = await getToken();
  const q = encodeURIComponent(`LEGO ${setNumber} sealed new`);
  const url =
    `https://api.ebay.com/buy/browse/v1/item_summary/search` +
    `?q=${q}&limit=10&filter=buyingOptions:{FIXED_PRICE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && attempt < 1) {
    await getToken(true);
    return fetchListingCount(setNumber, attempt + 1);
  }
  if (res.status === 429) {
    const backoff = Math.min(60000, 5000 * Math.pow(2, attempt));
    console.warn(`[ebay-comps] 429 — backoff ${backoff}ms`);
    await sleep(backoff);
    if (attempt < 3) return fetchListingCount(setNumber, attempt + 1);
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.total ?? data.itemSummaries?.length ?? 0;
}

async function loadCatalogSetNumbers() {
  const setNumbers = [];
  let lastKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(pk, :prefix) AND sk = :sk",
        ExpressionAttributeValues: {
          ":prefix": "CATALOG#PRODUCT#",
          ":sk": "v1",
        },
        ProjectionExpression: "pk, setNumber",
        ExclusiveStartKey: lastKey,
      })
    );
    for (const item of res.Items ?? []) {
      const sn =
        item.setNumber ?? item.pk?.replace("CATALOG#PRODUCT#", "");
      if (sn) setNumbers.push(String(sn));
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return Array.from(new Set(setNumbers)).sort();
}

async function main() {
  await getToken();
  const setNumbers = await loadCatalogSetNumbers();
  const toSync =
    LIMIT === Infinity ? setNumbers : setNumbers.slice(0, LIMIT);
  console.log(`[ebay-comps] Syncing ${toSync.length} sets...`);

  const now = new Date().toISOString();
  let ok = 0;
  let failed = 0;

  for (const setNumber of toSync) {
    try {
      const count = await fetchListingCount(setNumber);
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: `CATALOG#PRODUCT#${setNumber}`, sk: "v1" },
          UpdateExpression:
            "SET soldComps90d = :v, ebayCompsUpdatedAt = :ts",
          ExpressionAttributeValues: {
            ":v": count ?? 0,
            ":ts": now,
          },
        })
      );
      console.log(`  ${setNumber} — ${count ?? "err"} listings`);
      ok++;
    } catch (err) {
      console.warn(`  ${setNumber} — error: ${err.message}`);
      failed++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(
    `[ebay-comps] Done. ok=${ok} failed=${failed} of ${toSync.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
