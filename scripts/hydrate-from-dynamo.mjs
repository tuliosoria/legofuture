#!/usr/bin/env node
/**
 * scripts/hydrate-from-dynamo.mjs
 *
 * Pulls the catalog + pricing items out of DynamoDB (legofuture-cache) and
 * writes them to the two JSON files the Next.js build imports during static
 * generation. Run this in prebuild — it ensures the static export reflects
 * the latest snapshot in DynamoDB rather than any hand-edited mock data.
 *
 * Usage (CI/build):
 *   DYNAMODB_TABLE=legofuture-cache AWS_REGION=us-east-1 \
 *     node scripts/hydrate-from-dynamo.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../src/lib/data/sealed-ml");
const CATALOG_OUT = join(DATA_DIR, "sealed-catalog.json");
const PRICING_OUT = join(DATA_DIR, "pricecharting-current-prices.json");

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function queryAll(pk) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ExclusiveStartKey,
      })
    );
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function stripKeys(item) {
  const { pk, sk, ...rest } = item;
  return rest;
}

async function main() {
  console.log(`📥 Hydrating from ${TABLE} (${REGION})…`);

  const catalogItems = await queryAll("CATALOG");
  if (catalogItems.length === 0) {
    throw new Error(
      "DynamoDB CATALOG is empty. Run scripts/sync-pricecharting-to-dynamo.mjs first."
    );
  }
  const catalog = catalogItems.map(stripKeys).sort((a, b) => a.name.localeCompare(b.name));

  const pricingItems = await queryAll("PRICING");
  if (pricingItems.length === 0) {
    throw new Error(
      "DynamoDB PRICING is empty. Run scripts/sync-pricecharting-to-dynamo.mjs first."
    );
  }
  const pricingMap = {};
  for (const item of pricingItems) {
    const { productId, pk, sk, _source, ...fields } = item;
    pricingMap[productId] = fields;
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CATALOG_OUT, JSON.stringify(catalog, null, 2) + "\n");
  writeFileSync(PRICING_OUT, JSON.stringify(pricingMap, null, 2) + "\n");

  console.log(
    `✅ Hydrated: ${catalog.length} catalog sets → sealed-catalog.json; ${
      Object.keys(pricingMap).length
    } pricing snapshots → pricecharting-current-prices.json`
  );
}

main().catch((e) => {
  console.error(`❌ Hydrate failed:`, e);
  process.exit(1);
});
