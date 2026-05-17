#!/usr/bin/env node
/**
 * verify-syncs.mjs
 *
 * Scans the legofuture-cache DDB table for sync metadata and limitations
 * rows, then reports which sync pipelines have produced telemetry.
 *
 * Two schemas are supported (both are used across the sync scripts):
 *   1. pk = "META#SYNC_METADATA#<ISO>", sk = "v1"
 *   2. pk = "META",                     sk = "SYNC_METADATA#<ISO>"
 * Same dual schema for LIMITATIONS.
 *
 * Exit 0 if every expected script has >=1 metadata row.
 * Exit 1 if any expected script has zero metadata rows.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const EXPECTED_SCRIPTS = [
  "sync-pricecharting",
  "sync-pc-csv",
  "sync-trends",
  "sync-community",
  "sync-images",
  "validate-bricklink",
];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function isMetaSync(item) {
  const pk = item.pk || "";
  const sk = item.sk || "";
  return (
    pk.startsWith("META#SYNC_METADATA#") ||
    (pk === "META" && sk.startsWith("SYNC_METADATA#"))
  );
}

function isMetaLimitations(item) {
  const pk = item.pk || "";
  const sk = item.sk || "";
  return (
    pk.startsWith("META#LIMITATIONS#") ||
    (pk === "META" && sk.startsWith("LIMITATIONS#"))
  );
}

function extractTimestamp(item) {
  const pk = item.pk || "";
  const sk = item.sk || "";
  if (pk === "META") {
    const idx = sk.indexOf("#");
    if (idx !== -1) return sk.slice(idx + 1);
  }
  const parts = pk.split("#");
  if (parts.length >= 3) return parts.slice(2).join("#");
  return item.completed_at || item.finishedAt || item.capturedAt || "";
}

function extractRowsWritten(item) {
  return (
    item.total_products_synced ??
    item.history_rows_written ??
    item.rows_processed ??
    item.points_written ??
    item.scores_written ??
    item.images_linked ??
    item.urls_validated ??
    item.sets_processed ??
    item.sets_checked ??
    ""
  );
}

function pad(str, n) {
  const s = String(str ?? "");
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          "begins_with(pk, :metaHash) OR pk = :metaExact",
        ExpressionAttributeValues: {
          ":metaHash": "META#",
          ":metaExact": "META",
        },
        ExclusiveStartKey,
      }),
    );
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  const items = await scanAll();

  const metaByScript = new Map();
  const limitations = [];

  for (const it of items) {
    if (isMetaSync(it)) {
      const script = it.script;
      if (!script) continue;
      const ts = extractTimestamp(it);
      const arr = metaByScript.get(script) || [];
      arr.push({ ...it, _ts: ts });
      metaByScript.set(script, arr);
    } else if (isMetaLimitations(it)) {
      const ts = extractTimestamp(it);
      limitations.push({ ...it, _ts: ts });
    }
  }

  for (const arr of metaByScript.values()) {
    arr.sort((a, b) => String(b._ts).localeCompare(String(a._ts)));
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentLimitations = limitations
    .filter((l) => {
      const t = Date.parse(l._ts);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => String(b._ts).localeCompare(String(a._ts)));

  const rows = [];
  let allPresent = true;
  for (const script of EXPECTED_SCRIPTS) {
    const runs = metaByScript.get(script);
    if (!runs || runs.length === 0) {
      allPresent = false;
      rows.push({
        script,
        status: "MISSING",
        latest_run: "-",
        rows_written: "-",
        note: "no META#SYNC_METADATA row found",
      });
      continue;
    }
    const latest = runs[0];
    const limForScript = recentLimitations.filter((l) => l.script === script);
    const note = limForScript.length > 0
      ? `${limForScript.length} limitation(s) in last 7d`
      : "";
    rows.push({
      script,
      status: "OK",
      latest_run: latest._ts,
      rows_written: extractRowsWritten(latest),
      note,
    });
  }

  const header = {
    script: "script",
    status: "status",
    latest_run: "latest_run",
    rows_written: "rows_written",
    note: "note",
  };
  const widths = {
    script: 22,
    status: 8,
    latest_run: 26,
    rows_written: 14,
    note: 40,
  };
  const fmt = (r) =>
    [
      pad(r.script, widths.script),
      pad(r.status, widths.status),
      pad(r.latest_run, widths.latest_run),
      pad(r.rows_written, widths.rows_written),
      pad(r.note, widths.note),
    ].join(" | ");

  console.log(`\nDDB sync verification (table=${TABLE} region=${REGION})\n`);
  console.log(fmt(header));
  console.log("-".repeat(120));
  for (const r of rows) console.log(fmt(r));

  const pcRuns = metaByScript.get("sync-pricecharting") || [];
  if (pcRuns.length > 0) {
    const latestPc = pcRuns[0];
    console.log(
      `\nLatest sync-pricecharting total_products_synced: ${latestPc.total_products_synced ?? "n/a"} (at ${latestPc._ts})`,
    );
  } else {
    console.log("\nLatest sync-pricecharting total_products_synced: n/a (no runs)");
  }

  console.log(`\nLimitations in last 7 days: ${recentLimitations.length}`);
  for (const l of recentLimitations) {
    const note = l.error || l.note || l.reason || "";
    console.log(
      `  - [${l._ts}] script=${l.script ?? "?"} ${String(note).slice(0, 160)}`,
    );
  }

  if (!allPresent) {
    console.error("\n❌ Verification FAILED: one or more scripts have no metadata row.");
    process.exit(1);
  }
  console.log("\n✅ All expected sync scripts have metadata in DDB.");
  process.exit(0);
}

main().catch((err) => {
  console.error("verify-syncs error:", err);
  process.exit(1);
});
