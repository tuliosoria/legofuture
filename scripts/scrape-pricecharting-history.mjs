#!/usr/bin/env node
/**
 * scripts/scrape-pricecharting-history.mjs
 *
 * Scrapes the embedded price chart from each PriceCharting product page and
 * writes monthly HISTORY rows into DynamoDB `legofuture-cache`. This backfills
 * the historical depth that the public PC JSON API does not return — without it
 * every set forecast falls back to "Insufficient price history".
 *
 * For each catalog row (pk=CATALOG, sk=PRODUCT#<id>):
 *   1. Resolve the PriceCharting product id (PRICING._source, else search api).
 *   2. GET https://www.pricecharting.com/game/<pcId> (301-redirects to slug).
 *   3. Extract the embedded `VGPC.chart_data = { ... };` JSON blob.
 *   4. Map PC keys → app conditions (new→new-sealed, cib→complete, used→loose),
 *      keep one (last) datapoint per (condition × YYYY-MM), drop zero prices.
 *   5. Write each point as pk=`HISTORY#PRODUCT#<id>`,
 *      sk=`<condition>#<YYYY-MM-DD>`, { price, source, capturedAt } — the
 *      schema the loadHistory() reader already expects.
 *
 * No mock data. Sets where the page returns no chart_data are skipped and a
 * META#LIMITATIONS row is written instead.
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
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const SCRIPT_NAME = "scrape-pc-history";
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const TOKEN = process.env.PRICECHARTING_API_TOKEN;
const REQUEST_DELAY_MS = Number(process.env.PC_SCRAPE_DELAY_MS || 2000);
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONDITION_MAP = {
  new: "new-sealed",
  cib: "complete",
  used: "loose",
};

async function scanAll(filter, values) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: filter,
        ExpressionAttributeValues: values,
        ExclusiveStartKey,
      }),
    );
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function loadCatalog() {
  return scanAll(
    "pk = :pk AND begins_with(sk, :sk)",
    { ":pk": "CATALOG", ":sk": "PRODUCT#" },
  );
}

async function loadPricingMap() {
  const items = await scanAll(
    "pk = :pk AND begins_with(sk, :sk)",
    { ":pk": "PRICING", ":sk": "PRODUCT#" },
  );
  const map = new Map();
  for (const it of items) {
    if (it.productId && it._source) {
      map.set(String(it.productId), String(it._source));
    }
  }
  return map;
}

async function resolvePcIdViaSearch(setNumber) {
  if (!TOKEN) return null;
  const url =
    `https://www.pricecharting.com/api/products?q=${encodeURIComponent(setNumber)}&t=${TOKEN}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const products = data?.products;
  if (!Array.isArray(products) || products.length === 0) return null;
  const exact = products.find((p) =>
    String(p["product-name"] || "").includes(`#${setNumber}`),
  );
  return String((exact || products[0]).id || "") || null;
}

async function fetchProductHtml(pcId) {
  const url = `https://www.pricecharting.com/game/${pcId}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return { html: await res.text(), finalUrl: res.url };
}

function extractChartData(html) {
  const m = html.match(/VGPC\.chart_data\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * Reduce raw [[ts_ms, cents], ...] series into the last non-zero point of each
 * calendar month, returning [{ date: YYYY-MM-DD, price: number }, ...].
 */
function monthlyLastNonZero(series) {
  if (!Array.isArray(series)) return [];
  const byMonth = new Map();
  for (const entry of series) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const ts = Number(entry[0]);
    const cents = Number(entry[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(cents) || cents <= 0) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const ym = d.toISOString().slice(0, 7);
    const ymd = d.toISOString().slice(0, 10);
    const prev = byMonth.get(ym);
    if (!prev || ts >= prev.ts) {
      byMonth.set(ym, { ts, date: ymd, price: cents / 100 });
    }
  }
  return [...byMonth.values()]
    .map(({ date, price }) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function batchPut(items) {
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

async function writeLimitation(row) {
  const ts = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `META#LIMITATIONS#${ts}`,
        sk: "v1",
        script: SCRIPT_NAME,
        recorded_at: ts,
        ...row,
      },
    }),
  );
}

async function processSet(set, pricingMap) {
  const productId = String(set.id ?? set.setNumber ?? "");
  const setNumber = String(set.setNumber ?? productId);
  const name = String(set.name ?? productId);

  let pcId = pricingMap.get(productId);
  let pcSource = pcId ? "pricing-row" : null;
  if (!pcId) {
    pcId = await resolvePcIdViaSearch(setNumber);
    pcSource = pcId ? "pc-search" : null;
  }
  if (!pcId) {
    return {
      productId,
      setNumber,
      name,
      ok: false,
      rowsWritten: 0,
      reason: "no PC product id (no PRICING row and search returned nothing)",
    };
  }

  let html, finalUrl;
  try {
    ({ html, finalUrl } = await fetchProductHtml(pcId));
  } catch (err) {
    return {
      productId,
      setNumber,
      name,
      pcId,
      ok: false,
      rowsWritten: 0,
      reason: err.message,
    };
  }

  const chartData = extractChartData(html);
  if (!chartData) {
    return {
      productId,
      setNumber,
      name,
      pcId,
      pcUrl: finalUrl,
      ok: false,
      rowsWritten: 0,
      reason: "VGPC.chart_data not found in HTML",
    };
  }

  const capturedAt = new Date().toISOString();
  const items = [];
  const perCondition = {};
  for (const [pcKey, condition] of Object.entries(CONDITION_MAP)) {
    const points = monthlyLastNonZero(chartData[pcKey]);
    perCondition[condition] = points.length;
    for (const { date, price } of points) {
      items.push({
        pk: `HISTORY#PRODUCT#${productId}`,
        sk: `${condition}#${date}`,
        price,
        condition,
        source: "pricecharting-chart",
        sourceId: pcId,
        capturedAt,
      });
    }
  }

  if (items.length === 0) {
    return {
      productId,
      setNumber,
      name,
      pcId,
      pcUrl: finalUrl,
      ok: false,
      rowsWritten: 0,
      reason: "chart_data present but every series was empty/zero",
    };
  }

  await batchPut(items);
  return {
    productId,
    setNumber,
    name,
    pcId,
    pcSource,
    pcUrl: finalUrl,
    ok: true,
    rowsWritten: items.length,
    perCondition,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  console.log(`[${SCRIPT_NAME}] start at ${startedAt} table=${TABLE} region=${REGION}`);

  const [catalog, pricingMap] = await Promise.all([
    loadCatalog(),
    loadPricingMap(),
  ]);
  console.log(
    `[${SCRIPT_NAME}] catalog=${catalog.length} pricing_with_pc_id=${pricingMap.size}`,
  );

  let setsProcessed = 0;
  let historyRowsWritten = 0;
  let setsWithData = 0;
  let setsMissing = 0;
  const limitations = [];

  for (const set of catalog) {
    setsProcessed += 1;
    let result;
    try {
      result = await processSet(set, pricingMap);
    } catch (err) {
      result = {
        productId: String(set.id ?? set.setNumber ?? ""),
        setNumber: String(set.setNumber ?? ""),
        name: String(set.name ?? ""),
        ok: false,
        rowsWritten: 0,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    if (result.ok) {
      setsWithData += 1;
      historyRowsWritten += result.rowsWritten;
      console.log(
        `[${SCRIPT_NAME}] OK #${result.setNumber} ${result.name} pc=${result.pcId} rows=${result.rowsWritten} per=${JSON.stringify(result.perCondition)}`,
      );
    } else {
      setsMissing += 1;
      limitations.push({
        productId: result.productId,
        setNumber: result.setNumber,
        name: result.name,
        pcId: result.pcId,
        pcUrl: result.pcUrl,
        reason: result.reason,
      });
      console.warn(
        `[${SCRIPT_NAME}] SKIP #${result.setNumber} ${result.name}: ${result.reason}`,
      );
      await writeLimitation({
        productId: result.productId,
        setNumber: result.setNumber,
        name: result.name,
        pcId: result.pcId,
        pcUrl: result.pcUrl,
        error: result.reason,
        note: "scrape failed or returned no usable chart data",
      });
    }

    if (setsProcessed < catalog.length) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `META#SYNC_METADATA#${completedAt}`,
        sk: "v1",
        script: SCRIPT_NAME,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        sets_processed: setsProcessed,
        history_rows_written: historyRowsWritten,
        sets_with_data: setsWithData,
        sets_missing: setsMissing,
        request_delay_ms: REQUEST_DELAY_MS,
        source: "pricecharting-chart",
      },
    }),
  );

  console.log(
    `[${SCRIPT_NAME}] DONE sets_processed=${setsProcessed} sets_with_data=${setsWithData} sets_missing=${setsMissing} history_rows_written=${historyRowsWritten} duration_ms=${durationMs}`,
  );

  if (limitations.length > 0) {
    console.log(`[${SCRIPT_NAME}] limitations:`);
    for (const l of limitations) {
      console.log(`  - #${l.setNumber} ${l.name}: ${l.reason}`);
    }
  }
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${SCRIPT_NAME}] FATAL: ${message}`);
  try {
    await writeLimitation({ error: message, note: "script aborted" });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
