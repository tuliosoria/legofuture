#!/usr/bin/env node
/**
 * scripts/sync-google-trends.mjs
 *
 * Pulls Google Trends interest-over-time per LEGO set in the catalog and
 * writes monthly TRENDS#<setId>#<yyyymm> rows to the legofuture-cache table.
 *
 * Schema:
 *   pk = "TRENDS#<setId>" sk = "<yyyymm>" → { value: 0-100, capturedAt, term }
 *   pk = "META" sk = "SYNC_METADATA#<ISO>" → run metadata
 *   pk = "META" sk = "LIMITATIONS#<ISO>"   → per-set failures
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import googleTrends from "google-trends-api";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../src/lib/data/lego-ml/lego-catalog.json");

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const THROTTLE_MS = 2000;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadCatalog() {
  console.log(`📚 Scanning DynamoDB for CATALOG#PRODUCT# rows...`);
  const items = [];
  let ExclusiveStartKey;
  try {
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: { ":pk": "CATALOG", ":sk": "PRODUCT#" },
          ExclusiveStartKey,
        })
      );
      items.push(...(res.Items || []));
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);
  } catch (err) {
    console.warn(`   DDB scan failed: ${err.message}`);
  }
  if (items.length > 0) {
    console.log(`   Loaded ${items.length} sets from DynamoDB`);
    return items.map((i) => ({
      id: i.id ?? i.sk?.replace("PRODUCT#", ""),
      setNumber: i.setNumber,
      name: i.name,
      theme: i.theme,
    }));
  }
  console.log(`   No catalog rows in DDB; falling back to ${CATALOG_PATH}`);
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  console.log(`   Loaded ${catalog.length} sets from JSON`);
  return catalog;
}

function buildTerm(set) {
  if (set.setNumber && set.name) return `LEGO ${set.setNumber} ${set.name}`;
  if (set.theme && set.name) return `LEGO ${set.theme} ${set.name}`;
  return `LEGO ${set.name ?? set.id}`;
}

function yyyymm(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

async function fetchTrend(term) {
  const endTime = new Date();
  const startTime = new Date();
  startTime.setUTCMonth(startTime.getUTCMonth() - 24);
  const raw = await googleTrends.interestOverTime({
    keyword: term,
    startTime,
    endTime,
    granularTimeResolution: false,
  });
  const parsed = JSON.parse(raw);
  const timeline = parsed?.default?.timelineData;
  if (!Array.isArray(timeline)) {
    throw new Error("No timelineData in response");
  }
  return timeline;
}

async function batchWriteAll(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      })
    );
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const catalog = await loadCatalog();
  const failures = [];
  let setsProcessed = 0;
  let pointsWritten = 0;

  for (const set of catalog) {
    const id = set.id ?? set.setNumber;
    const term = buildTerm(set);
    setsProcessed += 1;
    console.log(`\n[${setsProcessed}/${catalog.length}] ${id} — "${term}"`);
    try {
      const timeline = await fetchTrend(term);
      if (timeline.length === 0) {
        console.log(`   ⚠️  empty timeline`);
        failures.push({ setId: id, reason: "Empty timeline (no data)" });
      } else {
        const monthlyMap = new Map();
        for (const point of timeline) {
          const ts = Number(point.time) * 1000;
          const month = yyyymm(ts);
          const value = Array.isArray(point.value) ? point.value[0] : point.value;
          if (typeof value !== "number") continue;
          const existing = monthlyMap.get(month);
          if (!existing) monthlyMap.set(month, { sum: value, n: 1 });
          else {
            existing.sum += value;
            existing.n += 1;
          }
        }
        const capturedAt = new Date().toISOString();
        const rows = [];
        for (const [month, { sum, n }] of monthlyMap.entries()) {
          rows.push({
            pk: `TRENDS#${id}`,
            sk: month,
            value: Math.round(sum / n),
            capturedAt,
            term,
          });
        }
        await batchWriteAll(rows);
        pointsWritten += rows.length;
        console.log(`   ✅ wrote ${rows.length} monthly points`);
      }
    } catch (err) {
      const reason = err?.message || String(err);
      console.log(`   ❌ ${reason}`);
      failures.push({ setId: id, reason: reason.slice(0, 300) });
    }
    await sleep(THROTTLE_MS);
  }

  const finishedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "META",
        sk: `SYNC_METADATA#${finishedAt}`,
        script: "sync-trends",
        startedAt,
        finishedAt,
        sets_processed: setsProcessed,
        points_written: pointsWritten,
        errors_count: failures.length,
      },
    })
  );

  if (failures.length > 0) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "META",
          sk: `LIMITATIONS#${finishedAt}`,
          script: "sync-trends",
          recordedAt: finishedAt,
          failures,
        },
      })
    );
    console.log(`\n⚠️  Recorded ${failures.length} failures in META#LIMITATIONS`);
  }

  console.log(
    `\n📈 Done. sets_processed=${setsProcessed} points_written=${pointsWritten} errors=${failures.length}`
  );
}

main().catch((err) => {
  console.error("FATAL setup error:", err);
  process.exit(1);
});
