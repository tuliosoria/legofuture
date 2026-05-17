#!/usr/bin/env node
/**
 * scripts/sync-pricecharting-to-dynamo.mjs
 *
 * Fetches live LEGO set pricing from PriceCharting for every set in the
 * curated catalog and writes both the catalog and the pricing snapshots to
 * the legofuture-cache DynamoDB table.
 *
 * Schema:
 *   pk = "CATALOG"  sk = "PRODUCT#<id>"   → full LegoSet fields
 *   pk = "PRICING"  sk = "PRODUCT#<id>"   → ProductPricing fields
 *   pk = "META"     sk = "LAST_SYNC"      → { lastSync: ISO timestamp }
 *
 * Usage:
 *   PRICECHARTING_API_TOKEN=<token> DYNAMODB_TABLE=legofuture-cache \
 *     AWS_REGION=us-east-1 node scripts/sync-pricecharting-to-dynamo.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../src/lib/data/lego-ml/lego-catalog.json");

const TOKEN = process.env.PRICECHARTING_API_TOKEN;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

if (!TOKEN) {
  console.error("❌ PRICECHARTING_API_TOKEN is required");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPrice(setNumber, name) {
  const q = encodeURIComponent(`LEGO ${setNumber} ${name}`);
  const url = `https://www.pricecharting.com/api/product?t=${TOKEN}&q=${q}&genre=LEGO+Set`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "success") {
    return null;
  }
  return {
    newPrice: data["new-price"] != null ? data["new-price"] / 100 : null,
    cibPrice: data["cib-price"] != null ? data["cib-price"] / 100 : null,
    loosePrice: data["loose-price"] != null ? data["loose-price"] / 100 : null,
    salesVolume: data["sales-volume"] ?? null,
    lastFetched: new Date().toISOString(),
    _source: data.id ?? null,
  };
}

async function batchWrite(items) {
  // BatchWrite max 25 per request
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
  console.log(`📚 Loading catalog from ${CATALOG_PATH}`);
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  console.log(`   ${catalog.length} sets`);

  console.log(`📤 Writing catalog items to ${TABLE}…`);
  const catalogItems = catalog.map((p) => ({
    pk: "CATALOG",
    sk: `PRODUCT#${p.id}`,
    ...p,
  }));
  await batchWrite(catalogItems);
  console.log(`   ✓ ${catalogItems.length} catalog items written`);

  console.log(`💰 Fetching live prices from PriceCharting…`);
  const pricingItems = [];
  let ok = 0;
  let miss = 0;
  for (const p of catalog) {
    try {
      const price = await fetchPrice(p.setNumber, p.name);
      if (!price) {
        console.warn(`   ⚠  ${p.setNumber} ${p.name}: no data`);
        miss++;
        await sleep(200);
        continue;
      }
      pricingItems.push({
        pk: "PRICING",
        sk: `PRODUCT#${p.id}`,
        productId: p.id,
        ...price,
      });
      ok++;
      console.log(`   ✓ ${p.setNumber} ${p.name} → new=$${price.newPrice ?? "?"} cib=$${price.cibPrice ?? "?"} vol=${price.salesVolume ?? "?"}`);
    } catch (e) {
      console.warn(`   ⚠  ${p.setNumber}: ${e.message}`);
      miss++;
    }
    await sleep(250);
  }

  console.log(`📤 Writing ${pricingItems.length} pricing items to ${TABLE}…`);
  await batchWrite(pricingItems);
  console.log(`   ✓ done`);

  console.log(`📤 Writing META#LAST_SYNC…`);
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "META",
        sk: "LAST_SYNC",
        lastSync: new Date().toISOString(),
        catalogCount: catalogItems.length,
        pricingCount: pricingItems.length,
        pricingMissed: miss,
      },
    })
  );

  console.log(`\n✅ Sync complete. catalog=${catalogItems.length} pricing=${ok} missed=${miss}`);
}

main().catch((e) => {
  console.error(`❌ Sync failed:`, e);
  process.exit(1);
});
