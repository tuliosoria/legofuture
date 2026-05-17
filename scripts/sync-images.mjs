#!/usr/bin/env node
/**
 * scripts/sync-images.mjs
 *
 * For each CATALOG#PRODUCT#<id> row in DynamoDB, fetch full product details
 * from the PriceCharting product detail endpoint and mirror the image URL(s)
 * onto the catalog row as `imageUrls: { primary, thumbnail }`.
 *
 * No S3 upload — URL linking only. Throttled to 1 req / 500ms.
 */

try {
  await import("dotenv/config");
} catch {
  // dotenv is optional; npm script loads env via `node --env-file=.env.local`
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const TOKEN = process.env.PRICECHARTING_API_TOKEN;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const SEARCH_ENDPOINT = "https://www.pricecharting.com/api/products";
const PAGE_BASE = "https://www.pricecharting.com/game";
const THROTTLE_MS = 500;
const MAX_SETS = process.env.SYNC_IMAGES_MAX
  ? Number(process.env.SYNC_IMAGES_MAX)
  : Infinity;

if (!TOKEN) {
  console.error("[sync-images] FATAL: PRICECHARTING_API_TOKEN is required");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function monthlyHistorySk(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function* scanCatalog() {
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          "begins_with(pk, :p1) OR (pk = :p2 AND begins_with(sk, :s))",
        ExpressionAttributeValues: {
          ":p1": "CATALOG#PRODUCT#",
          ":p2": "CATALOG",
          ":s": "PRODUCT#",
        },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) yield item;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

function extractImageUrls(html) {
  if (typeof html !== "string") return null;
  // PriceCharting CDN URLs follow pattern .../<hash>/<size>.jpg where size is 240 (thumb) or 1600 (full)
  const re =
    /https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[a-f0-9]+\/(?:240|1600)\.(?:jpg|jpeg|png|webp)/gi;
  const matches = html.match(re);
  if (!matches || matches.length === 0) return null;
  const byHash = new Map();
  for (const url of matches) {
    const m = url.match(
      /images\.pricecharting\.com\/([a-f0-9]+)\/(\d+)\.(jpg|jpeg|png|webp)/i,
    );
    if (!m) continue;
    const [, hash, size] = m;
    const entry = byHash.get(hash) || {};
    entry[size] = url;
    byHash.set(hash, entry);
  }
  const first = byHash.values().next().value;
  if (!first) return null;
  const primary = first["1600"] || first["240"];
  const thumbnail = first["240"] || first["1600"];
  if (!primary) return null;
  return { primary, thumbnail };
}

async function findPriceChartingProduct(setNumber) {
  const url = `${SEARCH_ENDPOINT}?platform=lego&q=${encodeURIComponent(setNumber)}&t=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  const products = Array.isArray(data.products) ? data.products : [];
  // Prefer exact set-number match in product-name (e.g. "Millennium Falcon #10179")
  const needle = `#${setNumber}`;
  const exact = products.find((p) =>
    typeof p["product-name"] === "string" &&
    p["product-name"].includes(needle),
  );
  return exact || products[0] || null;
}

async function findPriceChartingId(setNumber) {
  const product = await findPriceChartingProduct(setNumber);
  return product?.id || null;
}

async function fetchProductImages(pcId) {
  const res = await fetch(`${PAGE_BASE}/${encodeURIComponent(pcId)}`, {
    headers: { "user-agent": "legofuture-sync-images/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`page HTTP ${res.status}`);
  const html = await res.text();
  return extractImageUrls(html);
}

async function main() {
  const startedAt = new Date().toISOString();
  let setsProcessed = 0;
  let imagesLinked = 0;
  let missingCount = 0;
  let historySnapshotsWritten = 0;
  const failures = [];

  for await (const row of scanCatalog()) {
    if (setsProcessed >= MAX_SETS) break;
    const setNumber =
      row.setNumber || row.id || row.sk?.split("#").pop() || row.pk?.split("#").pop();
    if (!setNumber) continue;
    setsProcessed += 1;

    try {
      const pcProduct = await findPriceChartingProduct(setNumber);
      const pcId = pcProduct?.id || null;
      await sleep(THROTTLE_MS);
      let imageUrls = null;
      if (pcId) {
        imageUrls = await fetchProductImages(pcId);
      }

      if (pcProduct) {
        try {
          const nowIso = new Date().toISOString();
          await ddb.send(
            new PutCommand({
              TableName: TABLE,
              Item: {
                pk: `HISTORY#PRODUCT#${pcId}`,
                sk: monthlyHistorySk(),
                id: String(pcId),
                loose: pcProduct["loose-price"] ?? null,
                cib: pcProduct["cib-price"] ?? null,
                new: pcProduct["new-price"] ?? null,
                source: "pricecharting-snapshot",
                capturedAt: nowIso,
              },
            }),
          );
          historySnapshotsWritten += 1;
        } catch (histErr) {
          console.warn(
            `[sync-images] WARN history snapshot failed for set=${setNumber}: ${histErr?.message || histErr}`,
          );
        }
      }
      if (!imageUrls) {
        missingCount += 1;
        console.log(
          `[sync-images] no image for set=${setNumber} pcId=${pcId ?? "none"}, skipping`,
        );
      } else {
        await ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { pk: row.pk, sk: row.sk },
            UpdateExpression:
              "SET imageUrls = :u, imageUrlsUpdatedAt = :t, imageUrlsSource = :s",
            ExpressionAttributeValues: {
              ":u": imageUrls,
              ":t": new Date().toISOString(),
              ":s": "pricecharting",
            },
          }),
        );
        imagesLinked += 1;
        if (imagesLinked <= 5 || imagesLinked % 50 === 0) {
          console.log(
            `[sync-images] linked set=${setNumber} -> ${imageUrls.primary}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync-images] FAIL set=${setNumber}: ${msg}`);
      failures.push({ id: String(setNumber), error: msg });
    }

    await sleep(THROTTLE_MS);
  }

  const completedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `META#SYNC_METADATA#${completedAt}`,
        sk: "v1",
        script: "sync-images",
        sets_processed: setsProcessed,
        images_linked: imagesLinked,
        missing_count: missingCount,
        failure_count: failures.length,
        history_snapshots_written: historySnapshotsWritten,
        started_at: startedAt,
        completed_at: completedAt,
      },
    }),
  );

  if (failures.length > 0) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `META#LIMITATIONS#${completedAt}`,
          sk: "v1",
          script: "sync-images",
          failure_count: failures.length,
          sample_failures: failures.slice(0, 25),
          completed_at: completedAt,
        },
      }),
    );
  }

  console.log(
    `[sync-images] DONE processed=${setsProcessed} linked=${imagesLinked} missing=${missingCount} failures=${failures.length} historySnapshots=${historySnapshotsWritten}`,
  );
}

main().catch((err) => {
  console.error(`[sync-images] FATAL: ${err?.message || err}`);
  process.exit(1);
});
