#!/usr/bin/env node
/**
 * scripts/validate-bricklink.mjs
 *
 * For every set in the DDB legofuture-cache catalog, try candidate
 * BrickLink set URLs (variants -1, -2, -3) and persist the first
 * one that returns a real catalog page as BRICKLINK#SET#<slug>.
 *
 * Sets where no variant exists are aggregated into a single
 * META#LIMITATIONS row. A META#SYNC_METADATA row summarizes the run.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const THROTTLE_MS = 1000;
const MAX_SETS = process.env.VALIDATE_BL_MAX
  ? Number(process.env.VALIDATE_BL_MAX)
  : Infinity;
const VARIANTS = [1, 2, 3];
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Mirror of src/lib/domain/lego-bricklink.ts#isValidSetMarketplaceUrl.
function isValidSetMarketplaceUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("bricklink.com")) return false;
    if (!parsed.pathname.includes("catalogitem.page")) return false;
    const params = parsed.searchParams;
    const invalidKeys = ["P", "M", "I", "G", "B", "O"];
    if (invalidKeys.some((k) => params.has(k))) return false;
    return params.has("S");
  } catch {
    return false;
  }
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSlug(row) {
  if (row.slug && typeof row.slug === "string") return row.slug;
  const name = row.name || row.productName || row["product-name"] || "";
  const id = row.setNumber || row.id || "";
  return `${slugify(name)}-${id}`.replace(/^-+/, "");
}

async function* scanCatalog() {
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression:
          "begins_with(pk, :p1) OR (pk = :p2 AND begins_with(sk, :s))",
        ExpressionAttributeValues: {
          ":p1": "CATALOG#PRODUCT#",
          ":p2": "CATALOG",
          ":s": "PRODUCT#",
        },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) yield item;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
}

async function loadCatalogFallback() {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = resolve(here, "../src/lib/data/lego-ml/lego-catalog.json");
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

async function collectSets() {
  const out = [];
  for await (const row of scanCatalog()) {
    const setId = row.setNumber || row.id || row.sk?.split("#").pop();
    if (!setId) continue;
    out.push({
      setId: String(setId),
      slug: resolveSlug(row),
      name: row.name,
    });
  }
  if (out.length === 0) {
    console.log("[validate-bricklink] DDB catalog empty, using JSON fallback");
    const json = await loadCatalogFallback();
    for (const r of json) {
      const setId = r.setNumber || r.id;
      if (!setId) continue;
      out.push({
        setId: String(setId),
        slug: r.slug || resolveSlug(r),
        name: r.name,
      });
    }
  }
  return out;
}

async function tryVariant(setId, variant) {
  const url = `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setId}-${variant}`;
  if (!isValidSetMarketplaceUrl(url)) {
    return { ok: false, url, status: 0, reason: "invalid-url" };
  }
  let res;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
  } catch (err) {
    return { ok: false, url, status: 0, reason: `fetch-error:${err?.message || err}` };
  }
  if (res.status !== 200) {
    return { ok: false, url, status: res.status, reason: `http-${res.status}` };
  }
  let html = "";
  try {
    html = await res.text();
  } catch (err) {
    return { ok: false, url, status: res.status, reason: `body-error:${err?.message || err}` };
  }
  if (!html.toLowerCase().includes("catalogitem")) {
    return { ok: false, url, status: res.status, reason: "missing-catalogitem" };
  }
  if (html.includes("Item Not Found")) {
    return { ok: false, url, status: res.status, reason: "item-not-found" };
  }
  return { ok: true, url, status: res.status };
}

async function main() {
  const startedAt = new Date().toISOString();
  const sets = await collectSets();
  console.log(`[validate-bricklink] sets to check: ${sets.length}`);

  let setsChecked = 0;
  let urlsValidated = 0;
  const skipped = [];

  for (const s of sets) {
    if (setsChecked >= MAX_SETS) break;
    setsChecked += 1;
    let validated = null;
    for (const variant of VARIANTS) {
      const result = await tryVariant(s.setId, variant);
      await sleep(THROTTLE_MS);
      if (result.ok) {
        validated = result;
        break;
      } else {
        if (setsChecked <= 5 || setsChecked % 25 === 0) {
          console.log(
            `[validate-bricklink] miss set=${s.setId}-${variant} reason=${result.reason}`,
          );
        }
      }
    }
    if (!validated) {
      skipped.push(s.setId);
      console.log(`[validate-bricklink] SKIP set=${s.setId} (no variant matched)`);
      continue;
    }
    const validatedAt = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `BRICKLINK#SET#${s.slug}`,
          sk: "v1",
          url: validated.url,
          setId: s.setId,
          slug: s.slug,
          validatedAt,
          httpStatus: validated.status,
        },
      }),
    );
    urlsValidated += 1;
    if (urlsValidated <= 10 || urlsValidated % 25 === 0) {
      console.log(
        `[validate-bricklink] OK set=${s.setId} -> ${validated.url} (slug=${s.slug})`,
      );
    }
  }

  const completedAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `META#SYNC_METADATA#${completedAt}`,
        sk: "v1",
        script: "validate-bricklink",
        sets_checked: setsChecked,
        urls_validated: urlsValidated,
        skipped_count: skipped.length,
        started_at: startedAt,
        completed_at: completedAt,
      },
    }),
  );

  if (skipped.length > 0) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `META#LIMITATIONS#${completedAt}`,
          sk: "v1",
          script: "validate-bricklink",
          skipped_count: skipped.length,
          skipped_set_ids: skipped,
          completed_at: completedAt,
        },
      }),
    );
  }

  console.log(
    `[validate-bricklink] DONE checked=${setsChecked} validated=${urlsValidated} skipped=${skipped.length}`,
  );
}

main().catch((err) => {
  console.error(`[validate-bricklink] FATAL: ${err?.message || err}`);
  process.exit(1);
});
