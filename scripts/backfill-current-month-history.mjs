#!/usr/bin/env node
/**
 * scripts/backfill-current-month-history.mjs
 *
 * One-off bootstrap: scans every PRICING#PRODUCT#<id> row and writes a
 * HISTORY#PRODUCT#<id> sk=<YYYY-MM> snapshot for the current month using the
 * current loose/cib/new prices. Safe to re-run within the same month
 * (idempotent overwrite).
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
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

function monthlyHistorySk(date = new Date()) {
  // History rows from scrape-pricecharting-history use sk=`<condition>#<YYYY-MM-DD>`,
  // and loadHistory() filters with begins_with(sk, "<condition>#"). Snapshot the
  // current month as the first-of-month date in the same shape so it actually
  // surfaces in the chart.
  const ym = date.toISOString().slice(0, 7);
  return { ym, date: `${ym}-01` };
}

async function* scanPricing() {
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          "begins_with(pk, :p1) OR (pk = :p2 AND begins_with(sk, :s))",
        ExpressionAttributeValues: {
          ":p1": "PRICING#PRODUCT#",
          ":p2": "PRICING",
          ":s": "PRODUCT#",
        },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) yield item;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

async function main() {
  const startedAt = new Date().toISOString();
  const { ym: monthSk, date: snapshotDate } = monthlyHistorySk();
  let scanned = 0;
  let written = 0;
  const failures = [];

  const CONDITIONS = [
    { condition: "loose", field: "loosePrice" },
    { condition: "complete", field: "cibPrice" },
    { condition: "new-sealed", field: "newPrice" },
  ];

  for await (const row of scanPricing()) {
    scanned += 1;
    const id =
      row.id ||
      (row.pk?.startsWith("PRICING#PRODUCT#") ? row.pk.split("#").pop() : null) ||
      (row.pk === "PRICING" && row.sk?.startsWith("PRODUCT#")
        ? row.sk.split("#").pop()
        : null);
    if (!id) continue;
    for (const { condition, field } of CONDITIONS) {
      const raw = row[field];
      const price = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(price) || price <= 0) continue;
      try {
        await ddb.send(
          new PutCommand({
            TableName: TABLE,
            Item: {
              pk: `HISTORY#PRODUCT#${id}`,
              sk: `${condition}#${snapshotDate}`,
              price,
              condition,
              source: "pricecharting-snapshot",
              capturedAt: startedAt,
            },
          }),
        );
        written += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[backfill-history] FAIL id=${id} ${condition}: ${msg}`);
        failures.push({ id: String(id), condition, error: msg });
      }
    }
  }

  const completedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `META#SYNC_METADATA#${completedAt}`,
        sk: "v1",
        script: "backfill-current-month-history",
        month: monthSk,
        rows_scanned: scanned,
        history_snapshots_written: written,
        failure_count: failures.length,
        started_at: startedAt,
        completed_at: completedAt,
      },
    }),
  );

  console.log(
    `[backfill-history] DONE month=${monthSk} scanned=${scanned} written=${written} failures=${failures.length}`,
  );
}

main().catch((err) => {
  console.error(`[backfill-history] FATAL: ${err?.message || err}`);
  process.exit(1);
});
