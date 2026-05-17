#!/usr/bin/env node
/**
 * scripts/sync-pricecharting-to-dynamo.mjs
 *
 * Paginates the PriceCharting `lego` category to exhaustion and writes
 * CATALOG + PRICING rows plus sync_metadata to DynamoDB `legofuture-cache`.
 *
 * Spec §7. No mock data, no hard-coded set lists, no arbitrary cap.
 */

try {
  await import("dotenv/config");
} catch {
  // dotenv is optional; the npm script loads env via `node --env-file=.env.local`
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const TOKEN = process.env.PRICECHARTING_API_TOKEN;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const PAGE_SIZE = Number(process.env.PRICECHARTING_PAGE_SIZE || 250);
const ENDPOINT = "https://www.pricecharting.com/api/products";

if (!TOKEN) {
  console.error("[pc-sync] FATAL: PRICECHARTING_API_TOKEN is required");
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

function toHistoryItem(p, nowIso) {
  return {
    pk: `HISTORY#PRODUCT#${p.id}`,
    sk: monthlyHistorySk(new Date(nowIso)),
    id: String(p.id),
    loose: p["loose-price"] ?? null,
    cib: p["cib-price"] ?? null,
    new: p["new-price"] ?? null,
    source: "pricecharting-snapshot",
    capturedAt: nowIso,
  };
}

async function fetchPage(offset) {
  const url = `${ENDPOINT}?q=lego&t=${TOKEN}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} at offset=${offset}`);
  }
  const data = await res.json();
  if (data.status && data.status !== "success") {
    throw new Error(
      `API error at offset=${offset}: ${data["error-message"] || data.status}`,
    );
  }
  const all = Array.isArray(data.products) ? data.products : [];
  return all.filter((p) => {
    const consoleName = String(p["console-name"] || "");
    if (!consoleName.startsWith("LEGO ")) return false;
    if (consoleName === "LEGO Games") return false;
    return true;
  });
}

async function batchWriteAll(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let unprocessed = {
      [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })),
    };
    let attempt = 0;
    while (unprocessed[TABLE] && unprocessed[TABLE].length > 0) {
      const res = await ddb.send(
        new BatchWriteCommand({ RequestItems: unprocessed }),
      );
      unprocessed = res.UnprocessedItems || {};
      if (unprocessed[TABLE] && unprocessed[TABLE].length > 0) {
        attempt++;
        if (attempt > 6) {
          throw new Error("BatchWrite exceeded retry budget");
        }
        await sleep(200 * 2 ** attempt);
      }
    }
  }
}

function toCatalogItem(p, nowIso) {
  return {
    pk: `CATALOG#PRODUCT#${p.id}`,
    sk: "v1",
    id: String(p.id),
    productName: p["product-name"] ?? null,
    consoleName: p["console-name"] ?? null,
    genre: p.genre ?? null,
    releaseDate: p["release-date"] ?? null,
    raw: p,
    enrichmentStatus: "pricecharting-only",
    pricingProviderCount: 1,
    updatedAt: nowIso,
  };
}

function toPricingItem(p, nowIso) {
  return {
    pk: `PRICING#PRODUCT#${p.id}`,
    sk: "v1",
    id: String(p.id),
    "loose-price": p["loose-price"] ?? null,
    "cib-price": p["cib-price"] ?? null,
    "new-price": p["new-price"] ?? null,
    "retail-cib-buy": p["retail-cib-buy"] ?? null,
    "retail-cib-sell": p["retail-cib-sell"] ?? null,
    "retail-new-buy": p["retail-new-buy"] ?? null,
    "retail-new-sell": p["retail-new-sell"] ?? null,
    "retail-loose-buy": p["retail-loose-buy"] ?? null,
    "retail-loose-sell": p["retail-loose-sell"] ?? null,
    updatedAt: nowIso,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  let pages = 0;
  let total = 0;
  let lastLoggedBucket = 0;
  let historySnapshotsWritten = 0;

  try {
    let offset = 0;
    let consecutiveEmpty = 0;
    const MAX_EMPTY_STREAK = 3;
    while (true) {
      const products = await fetchPage(offset);
      pages += 1;
      if (products.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_EMPTY_STREAK) break;
        offset += PAGE_SIZE;
        await sleep(1100);
        continue;
      } else {
        consecutiveEmpty = 0;
      }

      const nowIso = new Date().toISOString();
      const catalogItems = products.map((p) => toCatalogItem(p, nowIso));
      const pricingItems = products.map((p) => toPricingItem(p, nowIso));
      await batchWriteAll(catalogItems);
      await batchWriteAll(pricingItems);

      try {
        const historyItems = products.map((p) => toHistoryItem(p, nowIso));
        for (const Item of historyItems) {
          await ddb.send(
            new PutCommand({ TableName: TABLE, Item }),
          );
          historySnapshotsWritten += 1;
        }
      } catch (histErr) {
        console.warn(
          `[pc-sync] WARN history snapshot write failed: ${histErr?.message || histErr}`,
        );
      }

      total += products.length;
      const bucket = Math.floor(total / 500);
      if (bucket > lastLoggedBucket) {
        lastLoggedBucket = bucket;
        console.log(`[pc-sync] fetched=${total} pages=${pages}`);
      }

      if (products.length < PAGE_SIZE) {
        // Filtered count below page size doesn't imply EOF — only consecutive
        // empty pages do. Continue paginating.
      }
      offset += PAGE_SIZE;
      await sleep(1100); // respect API rate limit (1 req/sec)
    }

    const completedAt = new Date().toISOString();
    const meta = {
      total_products_synced: total,
      pages_fetched: pages,
      started_at: startedAt,
      completed_at: completedAt,
      source: "pricecharting",
      token_present: true,
      history_snapshots_written: historySnapshotsWritten,
    };

    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: "META#LAST_SYNC", sk: "v1", ...meta },
      }),
    );
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `META#SYNC_METADATA#${completedAt}`,
          sk: "v1",
          ...meta,
        },
      }),
    );

    const durationMs = Date.now() - startMs;
    console.log(
      `[pc-sync] DONE total=${total} pages=${pages} duration=${durationMs}ms`,
    );
    process.exit(0);
  } catch (err) {
    const failedAt = new Date().toISOString();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pc-sync] ERROR: ${message}`);
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            pk: `META#LIMITATIONS#${failedAt}`,
            sk: "v1",
            script: "sync-pricecharting",
            error: message,
            partial_count: total,
            pages_fetched: pages,
            started_at: startedAt,
            failed_at: failedAt,
          },
        }),
      );
    } catch (writeErr) {
      console.error(
        `[pc-sync] also failed to write LIMITATIONS row: ${writeErr.message}`,
      );
    }
    process.exit(1);
  }
}

main();
