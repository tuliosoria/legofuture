#!/usr/bin/env node
/**
 * scripts/fetch-lego-prices.mjs
 *
 * Fetches current sealed prices from PriceCharting for every set in the catalog
 * and writes the results to src/lib/data/sealed-ml/pricecharting-current-prices.json.
 *
 * Usage:
 *   PRICECHARTING_API_TOKEN=<token> node scripts/fetch-lego-prices.mjs
 *
 * In CI / Amplify, set PRICECHARTING_API_TOKEN as an environment variable.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../src/lib/data/sealed-ml/sealed-catalog.json");
const OUTPUT_PATH = join(__dirname, "../src/lib/data/sealed-ml/pricecharting-current-prices.json");

const TOKEN = process.env.PRICECHARTING_API_TOKEN;
if (!TOKEN) {
  console.error("❌  PRICECHARTING_API_TOKEN is not set. Export it before running this script.");
  process.exit(1);
}

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} query */
async function fetchPrice(setNumber, name) {
  const q = encodeURIComponent(`LEGO ${setNumber} ${name}`);
  const url = `https://www.pricecharting.com/api/product?t=${TOKEN}&q=${q}&genre=LEGO+Set`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${setNumber}`);
  const data = await res.json();

  if (data.status === "error") {
    console.warn(`  ⚠  ${setNumber}: API returned error – ${data.error}`);
    return null;
  }

  return {
    newPrice: data["new-price"] != null ? data["new-price"] / 100 : null,
    cibPrice: data["cib-price"] != null ? data["cib-price"] / 100 : null,
    loosePrice: data["loose-price"] != null ? data["loose-price"] / 100 : null,
    salesVolume: data["sales-volume"] ?? null,
    lastFetched: new Date().toISOString().slice(0, 10),
    _source: data.id ?? null,
  };
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  console.log(`🔄  Fetching prices for ${catalog.length} sets…\n`);

  const results = {};

  for (const set of catalog) {
    process.stdout.write(`  ${set.setNumber} ${set.name}… `);
    try {
      const pricing = await fetchPrice(set.setNumber, set.name);
      if (pricing) {
        results[set.id] = pricing;
        console.log(`✓  new=$${pricing.newPrice ?? "—"}`);
      } else {
        console.log("skipped");
      }
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
    }
    await sleep(300); // respect rate limit
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\n✅  Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
