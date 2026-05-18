#!/usr/bin/env node
/**
 * scripts/sync-pricecharting-to-dynamo.mjs
 *
 * Iterates each LEGO "console" (theme) on PriceCharting and paginates with
 * offset=0,200,400,... until two consecutive empty pages, deduping by product
 * id across consoles. For each catalog row we join to its Rebrickable twin
 * (CATALOG#PRODUCT#{setNum}-1) to inherit imageUrl/pieceCount/themeName/year.
 *
 * Why per-console: PriceCharting's broad `q=lego` search ignores `offset` and
 * always returns the same 200 rows (~72 LEGO matches). Per-console queries do
 * paginate correctly, surfacing thousands of sets.
 *
 * Writes CATALOG#PRODUCT, PRICING#PRODUCT, HISTORY#PRODUCT, and META#LAST_SYNC
 * to the legofuture-cache DynamoDB table.
 */

try {
  await import("dotenv/config");
} catch {
  // dotenv is optional; npm script loads env via `node --env-file=.env.local`
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN = process.env.PRICECHARTING_API_TOKEN;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const PAGE_SIZE = Number(process.env.PRICECHARTING_PAGE_SIZE || 200);
const RATE_LIMIT_MS = Number(process.env.PRICECHARTING_RATE_LIMIT_MS || 1100);
const ENDPOINT = "https://www.pricecharting.com/api/products";
const CONSOLES_FILE = join(__dirname, "data", "pricecharting-lego-consoles.json");
const MAX_EMPTY_STREAK = 2;
const MAX_OFFSET = Number(process.env.PRICECHARTING_MAX_OFFSET || 5000);

if (!TOKEN) {
  console.error("[pc-sync] FATAL: PRICECHARTING_API_TOKEN is required");
  process.exit(1);
}

const consoles = JSON.parse(readFileSync(CONSOLES_FILE, "utf8"));
console.log(`[pc-sync] loaded ${consoles.length} LEGO consoles`);

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function monthlyHistorySk(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function fetchPage(consoleQuery, offset) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(consoleQuery)}&t=${TOKEN}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      await sleep(5000);
      return fetchPage(consoleQuery, offset);
    }
    throw new Error(`HTTP ${res.status} for q="${consoleQuery}" offset=${offset}`);
  }
  const data = await res.json();
  if (data.status && data.status !== "success") {
    throw new Error(
      `API error q="${consoleQuery}" offset=${offset}: ${data["error-message"] || data.status}`,
    );
  }
  const all = Array.isArray(data.products) ? data.products : [];
  // Keep only rows whose console-name matches the queried console exactly.
  // PC returns mixed results when the query is ambiguous; the exact-match
  // filter prevents (e.g.) "LEGO Star Wars" sets from leaking into "LEGO City"
  return all.filter((p) => String(p["console-name"] || "") === consoleQuery);
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
        if (attempt > 6) throw new Error("BatchWrite exceeded retry budget");
        await sleep(200 * 2 ** attempt);
      }
    }
  }
}

/**
 * Extract a LEGO set number from a PC product-name like "Cloud City #10123"
 * or "Millennium Falcon #75192". Returns the numeric portion or null.
 */
function extractSetNumber(productName) {
  if (!productName) return null;
  const m = String(productName).match(/#\s*(\d{3,7})\b/);
  return m ? m[1] : null;
}

// In-memory cache of rebrickable lookups within a single run
const rebrickableCache = new Map();

/**
 * Look up the Rebrickable twin row for a PC product. Tries `{setNum}-1`,
 * `{setNum}-2` (variants), then gives up. Returns the DDB Item or null.
 */
async function findRebrickableTwin(setNumber) {
  if (!setNumber) return null;
  if (rebrickableCache.has(setNumber)) return rebrickableCache.get(setNumber);
  for (const variant of ["-1", "-2", "-3"]) {
    try {
      const res = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: `CATALOG#PRODUCT#${setNumber}${variant}`, sk: "v1" },
      }));
      if (res.Item) {
        rebrickableCache.set(setNumber, res.Item);
        return res.Item;
      }
    } catch (e) {
      // tolerate transient lookup failures
    }
  }
  rebrickableCache.set(setNumber, null);
  return null;
}

async function toCatalogItem(p, nowIso) {
  const setNumber = extractSetNumber(p["product-name"]);
  const twin = await findRebrickableTwin(setNumber);
  return {
    pk: `CATALOG#PRODUCT#${p.id}`,
    sk: "v1",
    id: String(p.id),
    productName: p["product-name"] ?? null,
    consoleName: p["console-name"] ?? null,
    genre: p.genre ?? null,
    releaseDate: p["release-date"] ?? null,
    raw: p,
    // Rebrickable-enriched fields (only set when we found a twin)
    setNumber: setNumber ?? undefined,
    name: twin?.name ?? p["product-name"] ?? undefined,
    imageUrl: twin?.imageUrl ?? undefined,
    themeName: twin?.themeName ?? undefined,
    pieceCount: twin?.pieceCount ?? undefined,
    year: twin?.year ?? undefined,
    rebrickableUrl: twin?.rebrickableUrl ?? undefined,
    enrichmentStatus: twin ? "pricecharting+rebrickable" : "pricecharting-only",
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

async function syncConsole(consoleName, seenIds) {
  let offset = 0;
  let consecutiveEmpty = 0;
  let consoleTotal = 0;
  while (offset <= MAX_OFFSET) {
    let products;
    try {
      products = await fetchPage(consoleName, offset);
    } catch (e) {
      console.warn(`[pc-sync] WARN ${consoleName} offset=${offset}: ${e.message}`);
      break;
    }
    if (products.length === 0) {
      consecutiveEmpty += 1;
      if (consecutiveEmpty >= MAX_EMPTY_STREAK) break;
      offset += PAGE_SIZE;
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    consecutiveEmpty = 0;

    // Dedupe across consoles
    const fresh = products.filter((p) => {
      const id = String(p.id);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    if (fresh.length > 0) {
      const nowIso = new Date().toISOString();
      const catalogItems = await Promise.all(fresh.map((p) => toCatalogItem(p, nowIso)));
      const pricingItems = fresh.map((p) => toPricingItem(p, nowIso));
      const historyItems = fresh.map((p) => toHistoryItem(p, nowIso));
      await batchWriteAll(catalogItems);
      await batchWriteAll(pricingItems);
      await batchWriteAll(historyItems);
      consoleTotal += fresh.length;
    }

    offset += PAGE_SIZE;
    await sleep(RATE_LIMIT_MS);
  }
  return consoleTotal;
}

async function main() {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const seenIds = new Set();
  let grandTotal = 0;
  let consolesWithData = 0;

  for (let i = 0; i < consoles.length; i++) {
    const c = consoles[i];
    const beforeSize = seenIds.size;
    const wrote = await syncConsole(c, seenIds);
    if (wrote > 0) consolesWithData += 1;
    grandTotal += wrote;
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
    console.log(
      `[pc-sync] [${i + 1}/${consoles.length}] ${c}: +${wrote} (total ids=${seenIds.size}, +${seenIds.size - beforeSize}, ${elapsed}s elapsed)`,
    );
  }

  const completedAt = new Date().toISOString();
  const meta = {
    total_products_synced: grandTotal,
    unique_products: seenIds.size,
    consoles_attempted: consoles.length,
    consoles_with_data: consolesWithData,
    started_at: startedAt,
    completed_at: completedAt,
    source: "pricecharting-per-console",
    token_present: true,
  };

  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: "META#LAST_SYNC", sk: "v1", ...meta },
  }));
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: `META#SYNC_METADATA#${completedAt}`, sk: "v1", ...meta },
  }));

  const durationMs = Date.now() - startMs;
  console.log(
    `[pc-sync] DONE unique=${seenIds.size} written=${grandTotal} consoles=${consolesWithData}/${consoles.length} duration=${(durationMs/1000).toFixed(0)}s`,
  );
}

main().catch((err) => {
  console.error("[pc-sync] FATAL:", err);
  process.exit(1);
});
