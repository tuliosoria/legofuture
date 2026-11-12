#!/usr/bin/env node
/**
 * Daily current-price refresh from eBay (PriceCharting is cancelled since
 * November 2026). Writes one row per set:
 *
 *   pk=PRICING#PRODUCT#{setNumber}, sk=ebay-median
 *   { price, status, activeCount, p50, checkedAt, capturedAt, source: "ebay" }
 *
 * `price` is always the decided price (eBay median when the policy accepts
 * it, otherwise the last known price), so every surface that merges pricing
 * rows reads a number. The May 2026 PriceCharting rows stay as history.
 *
 * Work list: the 50 curated sets every day, plus a rotating slice of the
 * rest of the priced catalog (EBAY_ROTATION_LIMIT, default 600). The eBay
 * keyset is shared with PokeFuture (~5,000 calls/day), keep the total low.
 *
 * Nothing is written when an eBay request fails or when no price is
 * accepted — a broken run must not look like a quiet market.
 *
 * Usage: node scripts/refresh-ebay-prices.mjs [--dry-run] [--rotation=N] [--summary-out=path]
 * Env: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, AWS credentials, DYNAMODB_TABLE.
 * Spec: docs/superpowers/specs/2026-11-12-ebay-price-source-design.md
 */
import { writeFileSync } from "node:fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { LEGO_SETS } from "../src/lib/data/sets.ts";
import {
  buildWorkList,
  collectionLooksBroken,
  decideEbayPrice,
  isSetListing,
  summarizePrices,
} from "./lib/ebay-price-policy.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const DRY_RUN = args.includes("--dry-run");
const ROTATION = Number(flag("rotation") ?? process.env.EBAY_ROTATION_LIMIT ?? 600);
const SUMMARY_OUT = flag("summary-out");

for (const key of ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`[ebay-prices] ${key} is required`);
    process.exit(1);
  }
}

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const GAP_MS = Number(process.env.EBAY_RATE_LIMIT_MS || 150);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FatalEbayError extends Error {}

let token = null;
async function getToken(force = false) {
  if (token && !force) return token;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new FatalEbayError(`eBay token HTTP ${res.status}`);
  token = (await res.json()).access_token;
  return token;
}

const FILTER =
  "buyingOptions:{FIXED_PRICE},conditionIds:{1000},itemLocationCountry:US,deliveryCountry:US,priceCurrency:USD";

/** New, fixed-price US listings in LEGO Complete Sets & Packs (19006). */
async function searchSet(setNumber, lastKnown) {
  const params = new URLSearchParams({ q: `LEGO ${setNumber}`, category_ids: "19006", limit: "200", filter: FILTER });
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${await getToken(attempt > 0)}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      if (err instanceof FatalEbayError) throw err;
      await sleep(2_000 * (attempt + 1));
      continue;
    }
    if (res.status === 429) throw new FatalEbayError("eBay quota exhausted (429)");
    if (res.status === 401 && attempt === 0) continue;
    if (res.status === 401 || res.status === 403) throw new FatalEbayError(`eBay auth HTTP ${res.status}`);
    if (!res.ok) {
      await sleep(2_000 * (attempt + 1));
      continue;
    }
    const data = await res.json();
    const prices = (data.itemSummaries ?? [])
      .filter((item) => isSetListing(item.title, setNumber))
      .map((item) => Number(item.price?.value));
    return summarizePrices(prices, lastKnown);
  }
  throw new FatalEbayError(`eBay search for ${setNumber} kept failing`);
}

async function scanPrefix(prefix, projection, names) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(pk, :p)",
        ExpressionAttributeValues: { ":p": prefix },
        ProjectionExpression: projection,
        ExpressionAttributeNames: names,
        ExclusiveStartKey,
      })
    );
    out.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function loadState() {
  const [catalogRows, pricingRows] = await Promise.all([
    scanPrefix("CATALOG#PRODUCT#", "pk, sk, id, setNumber"),
    scanPrefix("PRICING#PRODUCT#", "pk, sk, #np, #p, checkedAt, capturedAt", { "#p": "price", "#np": "new-price" }),
  ]);
  const catalog = catalogRows
    .filter((r) => r.sk === "v1")
    .map((r) => ({ id: String(r.id ?? r.pk.slice("CATALOG#PRODUCT#".length)), setNumber: r.setNumber ? String(r.setNumber) : null }));
  const pcNewPriceCents = new Map();
  const ebayRows = new Map();
  for (const row of pricingRows) {
    const key = row.pk.slice("PRICING#PRODUCT#".length);
    if (row.sk === "v1" && typeof row["new-price"] === "number") pcNewPriceCents.set(key, row["new-price"]);
    if (row.sk === "ebay-median") ebayRows.set(key, row);
  }
  return { catalog, pcNewPriceCents, ebayRows };
}

async function writeRows(items) {
  for (let i = 0; i < items.length; i += 25) {
    let requests = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    for (let attempt = 0; requests.length > 0; attempt++) {
      if (attempt > 5) throw new Error("DynamoDB kept returning unprocessed items");
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: requests } }));
      requests = res.UnprocessedItems?.[TABLE] ?? [];
      if (requests.length) await sleep(500 * (attempt + 1));
    }
  }
}

function formatSummary(results, { dryRun }) {
  const count = (status) => results.filter((r) => r.status === status).length;
  const movers = results
    .filter((r) => r.status === "accepted" && r.lastKnown > 0)
    .map((r) => ({ ...r, change: r.price / r.lastKnown - 1 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 15);
  const lines = [
    `## eBay price refresh${dryRun ? " (dry run)" : ""}`,
    "",
    `Checked ${results.length} sets (${results.filter((r) => r.curated).length} curated).`,
    "",
    `| status | sets |`,
    `|---|---|`,
    `| accepted (eBay median) | ${count("accepted")} |`,
    `| thin (< 8 listings, kept last price) | ${count("thin")} |`,
    `| out-of-band (kept last price) | ${count("out-of-band")} |`,
    `| no data (kept last price) | ${count("no-data")} |`,
    "",
    "### Largest accepted moves",
    "",
    "| set | before | now | change | listings |",
    "|---|---|---|---|---|",
    ...movers.map(
      (r) =>
        `| ${r.setNumber}${r.curated ? " ★" : ""} | $${r.lastKnown.toFixed(2)} | $${r.price.toFixed(2)} | ${(r.change * 100).toFixed(1)}% | ${r.activeCount} |`
    ),
  ];
  return lines.join("\n") + "\n";
}

async function main() {
  const { catalog, pcNewPriceCents, ebayRows } = await loadState();
  const work = buildWorkList({ curated: LEGO_SETS, catalog, pcNewPriceCents, ebayRows, rotationLimit: ROTATION });
  console.log(`[ebay-prices] ${work.length} sets to check (${work.filter((w) => w.curated).length} curated, rotation ${ROTATION})`);

  const now = new Date().toISOString();
  const results = [];
  for (const [index, item] of work.entries()) {
    const aggregate = await searchSet(item.setNumber, item.lastKnown);
    const decision = decideEbayPrice({ lastKnown: item.lastKnown, aggregate });
    results.push({ ...item, ...decision, activeCount: aggregate?.activeCount ?? 0, p50: aggregate?.p50 ?? null });
    if ((index + 1) % 50 === 0) console.log(`[ebay-prices] ${index + 1}/${work.length}`);
    await sleep(GAP_MS);
  }

  const summary = formatSummary(results, { dryRun: DRY_RUN });
  console.log(summary);
  if (SUMMARY_OUT) writeFileSync(SUMMARY_OUT, summary);

  if (collectionLooksBroken(results)) {
    throw new Error("No eBay price was accepted — treating the collection as broken; nothing written.");
  }
  if (DRY_RUN) return;

  const rows = results.map((r) => ({
    pk: `PRICING#PRODUCT#${r.setNumber}`,
    sk: "ebay-median",
    setNumber: r.setNumber,
    source: "ebay",
    price: r.price,
    status: r.status,
    activeCount: r.activeCount,
    p50: r.p50 ?? undefined,
    checkedAt: now,
    // capturedAt = when the current price was last observed on eBay.
    capturedAt: r.status === "accepted" ? now : ebayRows.get(r.setNumber)?.capturedAt,
  }));
  await writeRows(rows);
  console.log(`[ebay-prices] wrote ${rows.length} rows to ${TABLE}`);
}

main().catch((err) => {
  console.error(`[ebay-prices] FAILED: ${err.message}`);
  process.exit(1);
});
