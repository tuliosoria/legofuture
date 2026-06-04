#!/usr/bin/env node
/**
 * Synthesise sparse history for the 50 MVP curated sets.
 *
 * For each set with < 3 real HISTORY#PRODUCT#<setNumber> rows in DDB,
 * back-fill 24 monthly rows derived from sets.ts (currentPrice,
 * momentum). Every synthetic row is stamped source="synthetic_backfill"
 * so the ML feature extractor can drop or down-weight them, and so
 * they auto-delete once real data accumulates.
 *
 * The real-row detection scans HISTORY rows for the set across all
 * conditions (new-sealed, complete, loose) — most scraped rows in DDB
 * are 'complete', so condition-naive counting matches reality.
 *
 * Idempotent: re-running overwrites existing synthetic_backfill rows;
 * never touches rows whose source field is missing (treated as real)
 * or whose source begins with anything other than "synthetic_backfill".
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { readFileSync } from "node:fs";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const MONTHS = 24;
const MIN_REAL_TO_SKIP = 3;
const CONDITION = "new-sealed";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

function parseMomentumAnnual(momentum) {
  if (!momentum) return 0.05;
  const m = String(momentum).match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) / 100 : 0.05;
}

function monthIsoDay(d) {
  // SK format used elsewhere in DDB is `{condition}#YYYY-MM-DD`. Use
  // first of month for synthetic rows.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function countRealHistory(setNumber) {
  let count = 0;
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      FilterExpression:
        "attribute_not_exists(#src) OR (NOT begins_with(#src, :syn))",
      ExpressionAttributeNames: { "#src": "source" },
      ExpressionAttributeValues: {
        ":pk": `HISTORY#PRODUCT#${setNumber}`,
        ":syn": "synthetic_backfill",
      },
      ExclusiveStartKey,
    }));
    count += (res.Items || []).length;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return count;
}

async function writeSynthetic(setNumber, currentPrice, momentum) {
  const annual = parseMomentumAnnual(momentum);
  const monthly = Math.pow(1 + annual, 1 / 12) - 1;
  const now = new Date();
  const rows = [];
  for (let n = MONTHS - 1; n >= 0; n--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
    const price = +(currentPrice / Math.pow(1 + monthly, n)).toFixed(2);
    rows.push({
      PutRequest: {
        Item: {
          pk: `HISTORY#PRODUCT#${setNumber}`,
          sk: `${CONDITION}#${monthIsoDay(d)}`,
          price,
          source: "synthetic_backfill",
          createdAt: new Date().toISOString(),
        },
      },
    });
  }
  for (let i = 0; i < rows.length; i += 25) {
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: rows.slice(i, i + 25) },
    }));
  }
}

function loadCuratedSets() {
  // Parse sets.ts without a TypeScript toolchain. Extract
  // { setNumber, currentPrice, momentum } per object literal.
  const txt = readFileSync("src/lib/data/sets.ts", "utf8");
  const out = [];
  const rx = /setNumber:\s*"([^"]+)"[\s\S]*?currentPrice:\s*(\d+)[\s\S]*?momentum:\s*"([^"]+)"/g;
  let m;
  while ((m = rx.exec(txt))) {
    out.push({ setNumber: m[1], currentPrice: Number(m[2]), momentum: m[3] });
  }
  return out;
}

async function main() {
  const sets = loadCuratedSets();
  if (sets.length === 0) {
    console.error("[synthesise] FATAL: no sets loaded from sets.ts");
    process.exit(1);
  }
  console.log(`[synthesise] checking ${sets.length} curated sets`);

  let synthesised = 0;
  let skipped = 0;
  for (const s of sets) {
    const real = await countRealHistory(s.setNumber);
    if (real >= MIN_REAL_TO_SKIP) {
      skipped++;
      continue;
    }
    console.log(`[synthesise] ${s.setNumber}: only ${real} real rows — back-filling ${MONTHS} months`);
    await writeSynthetic(s.setNumber, s.currentPrice, s.momentum);
    synthesised++;
  }
  console.log(`[synthesise] done. synthesised=${synthesised} skipped=${skipped}`);
}

main().catch((err) => {
  console.error("[synthesise] FATAL:", err);
  process.exit(1);
});
