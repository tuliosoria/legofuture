#!/usr/bin/env node
/**
 * build-baseline-pricing.mjs
 *
 * Computes per-theme median dollars-per-piece from the priced subset of the
 * catalog (sets that have both pieceCount AND a non-zero current price), then
 * writes the results to META#PRICING_BASELINE/v1 so the runtime forecast can
 * synthesize a "best-guess" current price for the unpriced majority.
 *
 * Idempotent. Re-run nightly (sync-all.sh appends it after source syncs).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const MIN_SAMPLES_PER_BUCKET = Number(process.env.BASELINE_MIN_SAMPLES || 10);

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

function median(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function loadCatalogIndexSafe() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ExpressionAttributeNames: { "#yr": "year" },
      ProjectionExpression: "id, setNumber, pieceCount, themeName, theme, #yr, retired, originalMsrp",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function loadAllPricingSafe() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p)",
      ExpressionAttributeValues: { ":p": "PRICING#PRODUCT#" },
      ExpressionAttributeNames: {
        "#np": "new-price",
        "#cp": "cib-price",
        "#lp": "loose-price",
      },
      ProjectionExpression: "pk, sk, #np, #cp, #lp, newAvg, usedAvg, currentValueNew, currentValueUsed, avgSoldPrice",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

function bestPriceFromRow(row) {
  // PC stores cents
  if (row.sk === "v1") {
    const v = Number(row["new-price"]) || Number(row["cib-price"]) || Number(row["loose-price"]);
    return Number.isFinite(v) && v > 0 ? v / 100 : null;
  }
  if (row.sk === "bricklink") {
    const v = Number(row.newAvg) || Number(row.usedAvg);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  if (row.sk === "brickset") {
    const v = Number(row.currentValueNew) || Number(row.currentValueUsed);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  if (row.sk === "ebay-sold") {
    const v = Number(row.avgSoldPrice);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  return null;
}

async function main() {
  console.log("[baseline] loading catalog…");
  const catalog = await loadCatalogIndexSafe();
  console.log(`[baseline] ${catalog.length} catalog rows`);

  // Index by id and setNumber so we can join from EITHER partition key style.
  const byKey = new Map();
  for (const row of catalog) {
    if (row.id) byKey.set(String(row.id), row);
    if (row.setNumber) byKey.set(String(row.setNumber), row);
  }

  console.log("[baseline] loading pricing rows…");
  const pricing = await loadAllPricingSafe();
  console.log(`[baseline] ${pricing.length} pricing rows across all sources`);

  // For each partition key, take the best price across rows (precedence).
  const PRECEDENCE = { v1: 0, bricklink: 1, brickset: 2, "ebay-sold": 3 };
  const bestByKey = new Map();
  for (const row of pricing) {
    const key = String(row.pk).replace(/^PRICING#PRODUCT#/, "");
    const price = bestPriceFromRow(row);
    if (price === null) continue;
    const existing = bestByKey.get(key);
    const rank = PRECEDENCE[row.sk] ?? 99;
    if (!existing || rank < existing.rank) bestByKey.set(key, { price, rank });
  }
  console.log(`[baseline] ${bestByKey.size} distinct keys with usable price`);

  // Build (product, price) samples
  const samples = [];
  for (const [key, { price }] of bestByKey) {
    const product = byKey.get(key);
    if (!product) continue;
    const pieces = Number(product.pieceCount);
    if (!Number.isFinite(pieces) || pieces <= 0) continue;
    const theme = String(product.themeName || product.theme || "Unknown");
    samples.push({
      theme,
      retired: !!product.retired,
      pieces,
      price,
      dollarsPerPiece: price / pieces,
    });
  }
  console.log(`[baseline] ${samples.length} (theme, pieces, price) samples`);

  // Bucket by (theme × retired)
  const buckets = new Map();
  for (const s of samples) {
    const k = `${s.theme}|${s.retired ? "retired" : "current"}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s.dollarsPerPiece);
  }

  const themeBuckets = {};
  for (const [k, vals] of buckets) {
    if (vals.length < MIN_SAMPLES_PER_BUCKET) continue;
    const [theme, status] = k.split("|");
    const med = median(vals);
    themeBuckets[theme] = themeBuckets[theme] || {};
    themeBuckets[theme][status] = { dollarsPerPiece: med, sampleCount: vals.length };
  }

  // Fallbacks: per-theme overall (any status), then global
  for (const theme of new Set(samples.map((s) => s.theme))) {
    if (!themeBuckets[theme]) themeBuckets[theme] = {};
    if (themeBuckets[theme].any) continue;
    const all = samples.filter((s) => s.theme === theme).map((s) => s.dollarsPerPiece);
    if (all.length >= MIN_SAMPLES_PER_BUCKET) {
      themeBuckets[theme].any = { dollarsPerPiece: median(all), sampleCount: all.length };
    }
  }

  const globalMedian = median(samples.map((s) => s.dollarsPerPiece));
  const retiredMedian = median(samples.filter((s) => s.retired).map((s) => s.dollarsPerPiece));
  const currentMedian = median(samples.filter((s) => !s.retired).map((s) => s.dollarsPerPiece));

  const baseline = {
    pk: "META#PRICING_BASELINE",
    sk: "v1",
    version: 1,
    builtAt: new Date().toISOString(),
    sampleCount: samples.length,
    themeCount: Object.keys(themeBuckets).length,
    globalDollarsPerPiece: globalMedian,
    retiredDollarsPerPiece: retiredMedian,
    currentDollarsPerPiece: currentMedian,
    themes: themeBuckets,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: baseline }));
  console.log(
    `[baseline] DONE: global=$${globalMedian?.toFixed(3)}/piece, ` +
    `${Object.keys(themeBuckets).length} themes, ${samples.length} samples`
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
