#!/usr/bin/env node
/**
 * scripts/sync-community.mjs
 *
 * Builds a community sentiment score per LEGO set from public review
 * aggregation (Brick Insights, https://brickinsights.com) and writes
 * `COMMUNITY#<setId>` rows to the legofuture-cache DynamoDB table.
 *
 * Source contract:
 *   - GET https://brickinsights.com/sets/<setNumber>-1
 *   - Parse the embedded schema.org Product JSON-LD for aggregateRating.
 *   - Throttle 1 request per 2 seconds.
 *   - No login-walled scraping. No mock data.
 *
 * Schema:
 *   pk = "COMMUNITY"  sk = "<setId>"
 *     { rating: 0-10, reviewCount, source: "brickinsights"|"brickset"|null,
 *       capturedAt, yyyymm }
 *   pk = "META"       sk = "SYNC_METADATA#<ISO>"
 *     { script, sets_processed, scores_written, missing_count, capturedAt }
 *   pk = "META"       sk = "LIMITATIONS#<ISO>"
 *     { script, missing_sets, note, capturedAt }
 *
 * Usage:
 *   AWS_REGION=us-east-1 DYNAMODB_TABLE=legofuture-cache \
 *     node --env-file=.env.local scripts/sync-community.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_CATALOG_PATH = join(
  __dirname,
  "../src/lib/data/lego-ml/lego-catalog.json"
);

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const USER_AGENT =
  "legofuture-sync-community/1.0 (+https://legofuture.app; research)";
const THROTTLE_MS = 2000;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function yyyymm(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

async function loadCatalog() {
  try {
    console.log(`📚 Scanning ${TABLE} for CATALOG#PRODUCT#* items…`);
    const items = [];
    let ExclusiveStartKey;
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: "pk = :pk AND begins_with(sk, :skp)",
          ExpressionAttributeValues: {
            ":pk": "CATALOG",
            ":skp": "PRODUCT#",
          },
          ExclusiveStartKey,
        })
      );
      items.push(...(res.Items || []));
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    if (items.length > 0) {
      console.log(`   ✓ ${items.length} catalog items from DDB`);
      return items.map((it) => ({
        id: it.id ?? it.sk?.replace(/^PRODUCT#/, ""),
        setNumber: it.setNumber,
        name: it.name,
      }));
    }
    console.warn(`   ⚠ no DDB catalog rows, falling back to seed JSON`);
  } catch (e) {
    console.warn(`   ⚠ DDB scan failed (${e.message}), falling back to seed`);
  }
  const seed = JSON.parse(readFileSync(SEED_CATALOG_PATH, "utf8"));
  console.log(`   ✓ ${seed.length} catalog items from seed JSON`);
  return seed.map((p) => ({
    id: p.id,
    setNumber: p.setNumber,
    name: p.name,
  }));
}

function extractJsonLdProduct(html) {
  // Find every <script type="application/ld+json"> block and pick the
  // first one whose @type === "Product".
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const c of candidates) {
        if (c && c["@type"] === "Product") return c;
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return null;
}

async function fetchBrickInsights(setNumber) {
  const url = `https://brickinsights.com/sets/${setNumber}-1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    redirect: "follow",
  });
  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) return { status: "error", reason: `HTTP ${res.status}` };

  const html = await res.text();
  const product = extractJsonLdProduct(html);
  if (!product) return { status: "no_data", reason: "no JSON-LD Product" };

  const agg = product.aggregateRating;
  if (!agg) return { status: "no_data", reason: "no aggregateRating" };

  const ratingValue = Number(agg.ratingValue);
  const bestRating = Number(agg.bestRating ?? 100);
  const reviewCount = Number(agg.reviewCount ?? agg.ratingCount ?? 0);

  if (!Number.isFinite(ratingValue) || !Number.isFinite(bestRating) || bestRating <= 0) {
    return { status: "no_data", reason: "unparseable rating" };
  }

  // Normalise to 0-10 scale.
  const rating = Math.round((ratingValue / bestRating) * 10 * 10) / 10;

  return {
    status: "ok",
    rating,
    reviewCount,
    source: "brickinsights",
  };
}

async function main() {
  const catalog = await loadCatalog();
  if (catalog.length === 0) {
    console.error("❌ No catalog items found (DDB or seed). Aborting.");
    process.exit(1);
  }

  const capturedAt = new Date().toISOString();
  const ym = yyyymm();

  let scoresWritten = 0;
  const missing = []; // { setId, setNumber, reason }

  console.log(
    `🌐 Querying Brick Insights for ${catalog.length} sets (throttle ${THROTTLE_MS}ms)…`
  );

  for (let i = 0; i < catalog.length; i++) {
    const p = catalog[i];
    if (!p.setNumber || !p.id) {
      missing.push({
        setId: p.id ?? null,
        setNumber: p.setNumber ?? null,
        reason: "missing setNumber/id in catalog",
      });
      continue;
    }

    let result;
    try {
      result = await fetchBrickInsights(p.setNumber);
    } catch (e) {
      result = { status: "error", reason: e.message };
    }

    if (result.status === "ok") {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            pk: `COMMUNITY#${p.id}`,
            sk: ym,
            setId: p.id,
            setNumber: p.setNumber,
            rating: result.rating,
            reviewCount: result.reviewCount,
            source: result.source,
            capturedAt,
          },
        })
      );
      scoresWritten++;
      console.log(
        `   ✓ ${p.setNumber} ${p.name} → ${result.rating}/10 (${result.reviewCount} reviews)`
      );
    } else {
      missing.push({
        setId: p.id,
        setNumber: p.setNumber,
        reason: result.reason || result.status,
      });
      console.log(`   – ${p.setNumber} ${p.name} → ${result.status}${result.reason ? `: ${result.reason}` : ""}`);
    }

    if (i < catalog.length - 1) await sleep(THROTTLE_MS);
  }

  console.log(`\n📤 Writing META#SYNC_METADATA#${capturedAt}…`);
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: "META",
        sk: `SYNC_METADATA#${capturedAt}`,
        script: "sync-community",
        sets_processed: catalog.length,
        scores_written: scoresWritten,
        missing_count: missing.length,
        capturedAt,
      },
    })
  );

  if (missing.length > 0) {
    const noCoverage = missing.length === catalog.length;
    const note = noCoverage
      ? "Most current seed sets are exclusive/premium with no BrickInsights coverage; render `Insufficient data` rather than $0/$—."
      : `${missing.length}/${catalog.length} sets had no community data; render \`Insufficient data\` for these rather than $0/$—.`;

    console.log(`📤 Writing META#LIMITATIONS#${capturedAt} (${missing.length} missing)…`);
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: "META",
          sk: `LIMITATIONS#${capturedAt}`,
          script: "sync-community",
          missing_count: missing.length,
          missing_sets: missing,
          source_attempted: "brickinsights",
          note,
          capturedAt,
        },
      })
    );
  }

  console.log(
    `\n✅ Sync complete. processed=${catalog.length} written=${scoresWritten} missing=${missing.length}`
  );
}

main().catch((e) => {
  console.error("❌ sync-community failed:", e);
  process.exit(1);
});
