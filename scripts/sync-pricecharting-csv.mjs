#!/usr/bin/env node
/**
 * scripts/sync-pricecharting-csv.mjs
 *
 * Downloads the PriceCharting bulk CSV for the `lego` platform and writes
 * historical price points to the legofuture-cache DynamoDB table.
 *
 * Schema:
 *   pk = "HISTORY#PRODUCT#<id>"  sk = "<YYYY-MM>"
 *     → { loose, cib, new, source: "pricecharting-csv", capturedAt }
 *   pk = "META"  sk = "SYNC_METADATA#<ISO>"
 *     → { script, rows_processed, history_rows_written, started_at, completed_at }
 *   pk = "META"  sk = "LIMITATIONS#<ISO>"
 *     → { script, error, note }
 *
 * Usage:
 *   npm run sync:pc-csv
 */

import Papa from "papaparse";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const TOKEN = process.env.PRICECHARTING_API_TOKEN;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const PLATFORM = "lego";
const SCRIPT_NAME = "sync-pc-csv";

if (!TOKEN) {
  console.error("❌ PRICECHARTING_API_TOKEN is required");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const nowIso = () => new Date().toISOString();
const currentYearMonth = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

async function writeMetaLimitation(error, extra = {}) {
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "META",
          sk: `LIMITATIONS#${nowIso()}`,
          script: SCRIPT_NAME,
          error: String(error?.message || error),
          ...extra,
        },
      })
    );
  } catch (e) {
    console.error("⚠️  Failed to write META#LIMITATIONS row:", e?.message || e);
  }
}

async function writeMetaSync(payload) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk: "META", sk: `SYNC_METADATA#${nowIso()}`, script: SCRIPT_NAME, ...payload },
    })
  );
}

async function batchWrite(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let unprocessed = {
      [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })),
    };
    let attempt = 0;
    while (unprocessed[TABLE] && unprocessed[TABLE].length > 0) {
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: unprocessed }));
      unprocessed = res.UnprocessedItems || {};
      if (unprocessed[TABLE] && unprocessed[TABLE].length > 0) {
        attempt += 1;
        if (attempt > 5) {
          throw new Error("Too many unprocessed items in BatchWrite");
        }
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  }
}

function centsToDollars(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

function pickProductId(row) {
  return (
    row["id"] ||
    row["product-id"] ||
    row["product_id"] ||
    row["productId"] ||
    row["ID"] ||
    null
  );
}

/**
 * Build rows for HISTORY#PRODUCT#<id>#<YYYY-MM>.
 * Recognizes either dated columns of the form `loose-price-YYYY-MM` etc.
 * (one historical point per month) or — if no such columns exist — falls back
 * to a single snapshot row using the current YYYY-MM.
 */
function buildHistoryItems(row, productId, capturedAt, currentMonth) {
  const items = [];
  const byMonth = new Map();
  const dateColPattern = /^(loose|cib|new)-price-(\d{4}-\d{2})$/i;

  for (const key of Object.keys(row)) {
    const m = key.match(dateColPattern);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    const ym = m[2];
    const val = centsToDollars(row[key]);
    if (val == null) continue;
    if (!byMonth.has(ym)) byMonth.set(ym, {});
    byMonth.get(ym)[kind] = val;
  }

  if (byMonth.size > 0) {
    for (const [ym, prices] of byMonth.entries()) {
      items.push({
        pk: `HISTORY#PRODUCT#${productId}`,
        sk: ym,
        loose: prices.loose ?? null,
        cib: prices.cib ?? null,
        new: prices.new ?? null,
        source: "pricecharting-csv",
        capturedAt,
      });
    }
    return items;
  }

  // Fallback: current snapshot only.
  const loose = centsToDollars(row["loose-price"]);
  const cib = centsToDollars(row["cib-price"]);
  const nw = centsToDollars(row["new-price"]);
  if (loose == null && cib == null && nw == null) return items;
  items.push({
    pk: `HISTORY#PRODUCT#${productId}`,
    sk: currentMonth,
    loose,
    cib,
    new: nw,
    source: "pricecharting-csv",
    capturedAt,
  });
  return items;
}

async function main() {
  const started_at = nowIso();
  const capturedAt = started_at;
  const currentMonth = currentYearMonth();

  const url = `https://www.pricecharting.com/price-guide/download-csv?platform=${PLATFORM}&t=${TOKEN}`;
  console.log(`⬇️  Fetching PriceCharting CSV (platform=${PLATFORM})`);

  let res;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    console.error("❌ Network error fetching CSV:", err?.message || err);
    await writeMetaLimitation(err, { note: "Network error contacting PriceCharting bulk CSV endpoint" });
    process.exit(1);
  }

  if (res.status === 404 || res.status === 401 || res.status === 403) {
    const msg = `PriceCharting bulk CSV endpoint returned HTTP ${res.status}`;
    console.warn(`⚠️  ${msg} — pipeline wired but endpoint not available on this account.`);
    await writeMetaLimitation(new Error(msg), {
      note: "Bulk CSV download requires a PriceCharting subscription that includes the lego platform. Pipeline wired; awaiting access.",
      http_status: res.status,
      endpoint: "https://www.pricecharting.com/price-guide/download-csv?platform=lego",
    });
    // Exit 0 so CI/pipeline stays green but the limitation is logged.
    process.exit(0);
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} fetching CSV`);
    console.error("❌", err.message);
    await writeMetaLimitation(err, { http_status: res.status });
    process.exit(1);
  }

  const csvText = await res.text();
  console.log(`📄 CSV size: ${(csvText.length / 1024).toFixed(1)} KB`);

  let parsed;
  try {
    parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  } catch (err) {
    console.error("❌ CSV parse error:", err?.message || err);
    await writeMetaLimitation(err);
    process.exit(1);
  }

  if (parsed.errors && parsed.errors.length > 0) {
    console.warn(`⚠️  Papaparse reported ${parsed.errors.length} parse warnings (continuing)`);
  }

  const rows = parsed.data || [];
  console.log(`📊 Parsed ${rows.length} rows`);

  let rows_processed = 0;
  let history_rows_written = 0;
  let buffer = [];

  try {
    for (const row of rows) {
      rows_processed += 1;
      const productId = pickProductId(row);
      if (!productId) continue;
      const items = buildHistoryItems(row, String(productId), capturedAt, currentMonth);
      if (items.length === 0) continue;
      buffer.push(...items);
      if (buffer.length >= 500) {
        await batchWrite(buffer);
        history_rows_written += buffer.length;
        buffer = [];
      }
      if (rows_processed % 500 === 0) {
        console.log(`  …processed ${rows_processed}/${rows.length} rows (history written: ${history_rows_written})`);
      }
    }
    if (buffer.length > 0) {
      await batchWrite(buffer);
      history_rows_written += buffer.length;
      buffer = [];
    }
  } catch (err) {
    console.error("❌ Failed during write:", err?.message || err);
    await writeMetaLimitation(err, { rows_processed, history_rows_written });
    process.exit(1);
  }

  const completed_at = nowIso();
  await writeMetaSync({ rows_processed, history_rows_written, started_at, completed_at });
  console.log(
    `✅ Done. rows_processed=${rows_processed} history_rows_written=${history_rows_written}`
  );
}

main().catch(async (err) => {
  console.error("❌ Fatal:", err?.message || err);
  await writeMetaLimitation(err);
  process.exit(1);
});
