#!/usr/bin/env node
// Seed CATALOG#PRODUCT#* rows from Rebrickable's public CSV downloads.
// No API key required — uses https://rebrickable.com/downloads/ CDN URLs.
// Produces the same DDB row shape as scripts/sync-rebrickable-catalog.mjs.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const CACHE_DIR = ".cache/rebrickable";
const SETS_URL = "https://cdn.rebrickable.com/media/downloads/sets.csv.gz";
const THEMES_URL = "https://cdn.rebrickable.com/media/downloads/themes.csv.gz";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);

async function downloadGz(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function readCsv(gzPath) {
  const rows = [];
  let header = null;
  const stream = createReadStream(gzPath).pipe(createGunzip());
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) { header = cols; continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i];
    rows.push(row);
  }
  return rows;
}

async function batchWriteAll(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let unprocessed = { [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })) };
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: unprocessed }));
      if (!res.UnprocessedItems || !res.UnprocessedItems[TABLE] || res.UnprocessedItems[TABLE].length === 0) break;
      unprocessed = res.UnprocessedItems;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const setsGz = `${CACHE_DIR}/sets.csv.gz`;
  const themesGz = `${CACHE_DIR}/themes.csv.gz`;

  console.log("[rb-csv] downloading themes.csv.gz…");
  await downloadGz(THEMES_URL, themesGz);
  console.log("[rb-csv] downloading sets.csv.gz…");
  await downloadGz(SETS_URL, setsGz);

  console.log("[rb-csv] parsing themes…");
  const themeRows = await readCsv(themesGz);
  const themes = {};
  for (const t of themeRows) themes[t.id] = { name: t.name, parent_id: t.parent_id || null };
  console.log(`[rb-csv] ${Object.keys(themes).length} themes`);

  console.log("[rb-csv] parsing sets…");
  const setRows = await readCsv(setsGz);
  console.log(`[rb-csv] ${setRows.length} sets`);

  const nowIso = new Date().toISOString();
  let count = 0;
  let buffer = [];

  for (const s of setRows) {
    const theme = themes[s.theme_id] || { name: "Unknown" };
    buffer.push({
      pk: `CATALOG#PRODUCT#${s.set_num}`,
      sk: "v1",
      id: s.set_num,
      name: s.name,
      year: Number(s.year) || undefined,
      themeId: Number(s.theme_id) || undefined,
      themeName: theme.name,
      pieceCount: Number(s.num_parts) || undefined,
      imageUrl: s.img_url || undefined,
      rebrickableUrl: `https://rebrickable.com/sets/${s.set_num}/`,
      enrichmentStatus: "rebrickable-only",
      pricingProviderCount: 0,
      source: "rebrickable-csv",
      updatedAt: nowIso,
    });
    count++;
    if (buffer.length >= 500) {
      await batchWriteAll(buffer);
      buffer = [];
      if (count % 2500 === 0) console.log(`[rb-csv] ${count} sets written`);
    }
  }
  if (buffer.length) await batchWriteAll(buffer);
  console.log(`[rb-csv] complete: ${count} sets written`);

  await ddb.send(new BatchWriteCommand({
    RequestItems: {
      [TABLE]: [{
        PutRequest: {
          Item: {
            pk: `META#SYNC#rebrickable-csv#${nowIso}`,
            sk: "v1",
            source: "rebrickable-csv",
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
