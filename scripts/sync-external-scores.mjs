#!/usr/bin/env node
// Refreshes DDB external scores for all sets in lego-curated-sets.json.
// Run: node --env-file=.env.local scripts/sync-external-scores.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const curatedSets = JSON.parse(
  readFileSync(join(__dirname, "../src/lib/data/lego-curated-sets.json"), "utf8")
);

async function getBricklinkSoldCount(setNumber) {
  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "bricklink" },
      })
    );
    return res.Item?.usedSoldCount6mo ?? res.Item?.newSoldCount6mo ?? null;
  } catch {
    return null;
  }
}

async function getCurrentPrice(setNumber) {
  try {
    const pcRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "v1" },
      })
    );
    if (pcRes.Item?.["new-price"]) {
      return Number(pcRes.Item["new-price"]) / 100;
    }
    const blRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "bricklink" },
      })
    );
    return blRes.Item?.newAvg ?? null;
  } catch {
    return null;
  }
}

function estimateRetirementMonths(set) {
  if (set.retired) return null;
  if (set.retiringSoon) return 6;
  return null;
}

async function syncSet(set) {
  const [bricklinkSoldCount6mo, currentPrice] = await Promise.all([
    getBricklinkSoldCount(set.setNumber),
    getCurrentPrice(set.setNumber),
  ]);

  const retirementMonthsRemaining = estimateRetirementMonths(set);

  let voteCount = 0;
  try {
    const existing = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `CURATED#SET#${set.setNumber}`, sk: "scores" },
      })
    );
    voteCount = existing.Item?.voteCount ?? 0;
  } catch {}

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `CURATED#SET#${set.setNumber}`,
        sk: "scores",
        setNumber: set.setNumber,
        bricklinkSoldCount6mo,
        retirementMonthsRemaining,
        currentPrice,
        voteCount,
        lastRefreshed: new Date().toISOString(),
      },
    })
  );

  console.log(
    `[sync-scores] ${set.setNumber} ${set.name} — price: ${currentPrice ?? "n/a"}, bl-sold: ${bricklinkSoldCount6mo ?? "n/a"}`
  );
}

console.log(`[sync-scores] Syncing ${curatedSets.length} curated sets...`);
for (const set of curatedSets) {
  await syncSet(set);
}
console.log("[sync-scores] Done.");
