#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const KEY = process.env.REBRICKABLE_API_KEY;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const BASE = "https://rebrickable.com/api/v3/lego";
const CACHE_DIR = ".cache/rebrickable";
const PAGE_SIZE = 1000;

if (!KEY) { console.error("[rb-sync] FATAL: REBRICKABLE_API_KEY required"); process.exit(1); }

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rbFetch(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}key=${KEY}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`Rate-limited after 3 retries: ${path}`);
}

async function loadThemes() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = `${CACHE_DIR}/themes.json`;
  if (existsSync(cachePath)) return JSON.parse(await readFile(cachePath, "utf8"));
  const out = {};
  let url = `/themes/?page_size=${PAGE_SIZE}`;
  while (url) {
    const data = await rbFetch(url);
    for (const t of data.results) out[t.id] = { name: t.name, parent_id: t.parent_id };
    url = data.next ? data.next.replace(/^.*\/api\/v3\/lego/, "").replace(/&?key=[^&]+/, "") : null;
  }
  await writeFile(cachePath, JSON.stringify(out, null, 2));
  return out;
}

async function* paginateSets() {
  let url = `/sets/?page_size=${PAGE_SIZE}&ordering=set_num`;
  while (url) {
    const data = await rbFetch(url);
    for (const s of data.results) yield s;
    url = data.next ? data.next.replace(/^.*\/api\/v3\/lego/, "").replace(/&?key=[^&]+/, "") : null;
  }
}

async function batchWriteAll(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })) },
    }));
  }
}

async function main() {
  console.log("[rb-sync] loading themes…");
  const themes = await loadThemes();
  console.log(`[rb-sync] ${Object.keys(themes).length} themes`);

  const nowIso = new Date().toISOString();
  let count = 0;
  let buffer = [];

  for await (const s of paginateSets()) {
    const theme = themes[s.theme_id] || { name: "Unknown" };
    buffer.push({
      pk: `CATALOG#PRODUCT#${s.set_num}`,
      sk: "v1",
      id: s.set_num,
      name: s.name,
      year: s.year,
      themeId: s.theme_id,
      themeName: theme.name,
      pieceCount: s.num_parts,
      imageUrl: s.set_img_url,
      rebrickableUrl: s.set_url,
      enrichmentStatus: "rebrickable-only",
      pricingProviderCount: 0,
      source: "rebrickable",
      updatedAt: nowIso,
    });
    count++;
    if (buffer.length >= 100) {
      await batchWriteAll(buffer);
      buffer = [];
      if (count % 1000 === 0) console.log(`[rb-sync] ${count} sets written`);
    }
  }
  if (buffer.length) await batchWriteAll(buffer);
  console.log(`[rb-sync] complete: ${count} sets`);

  await ddb.send(new BatchWriteCommand({
    RequestItems: {
      [TABLE]: [{
        PutRequest: {
          Item: {
            pk: `META#SYNC#rebrickable#${nowIso}`,
            sk: "v1",
            source: "rebrickable",
            totalProductsSynced: count,
            startedAt: nowIso,
            finishedAt: new Date().toISOString(),
          },
        },
      }],
    },
  }));
}

main().catch((err) => { console.error(err); process.exit(1); });
