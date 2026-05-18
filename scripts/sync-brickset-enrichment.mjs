#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["BRICKSET_API_KEY", "BRICKSET_USERNAME", "BRICKSET_PASSWORD"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[bs-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const BASE = "https://brickset.com/api/v3.asmx";
const RATE_LIMIT_MS = Number(process.env.BRICKSET_RATE_LIMIT_MS || 1000);
const PROGRESS_KEY = { pk: "META#BRICKSET_PROGRESS", sk: "v1" };
const PROGRESS_FLUSH_EVERY = 25;
const RESUME = process.env.BRICKSET_RESUME !== "false";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bsFetch(url, attempt = 0) {
  const res = await fetch(url);
  if (res.status === 429 || res.status === 503) {
    const backoff = Math.min(60000, 5000 * Math.pow(2, attempt));
    console.warn(`[bs-sync] ${res.status} — backoff ${backoff}ms (attempt ${attempt + 1})`);
    await sleep(backoff);
    if (attempt < 4) return bsFetch(url, attempt + 1);
    throw new Error(`${res.status} too many retries`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function bsLogin() {
  const url = `${BASE}/login?apiKey=${process.env.BRICKSET_API_KEY}&username=${encodeURIComponent(process.env.BRICKSET_USERNAME)}&password=${encodeURIComponent(process.env.BRICKSET_PASSWORD)}`;
  const data = await bsFetch(url);
  if (data.status !== "success") throw new Error(`Brickset login failed: ${data.message}`);
  return data.hash;
}

async function getSet(userHash, setNum) {
  const params = JSON.stringify({ setNumber: setNum });
  const url = `${BASE}/getSets?apiKey=${process.env.BRICKSET_API_KEY}&userHash=${userHash}&params=${encodeURIComponent(params)}`;
  const data = await bsFetch(url);
  return data.sets?.[0] || null;
}

async function loadAllSetNums() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk AND attribute_exists(setNumber)",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "setNumber",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) if (item.setNumber) out.push(String(item.setNumber));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return Array.from(new Set(out)).sort();
}

async function loadProgress() {
  if (!RESUME) return { lastProcessed: null };
  try {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: PROGRESS_KEY }));
    return { lastProcessed: res.Item?.lastProcessed ?? null };
  } catch { return { lastProcessed: null }; }
}

async function saveProgress(lastProcessed, processedCount) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...PROGRESS_KEY, lastProcessed, processedCount, updatedAt: new Date().toISOString() },
  }));
}

async function main() {
  const userHash = await bsLogin();
  const setNums = await loadAllSetNums();
  console.log(`[bs-sync] ${setNums.length} sets to enrich`);
  const { lastProcessed } = await loadProgress();
  let startIdx = 0;
  if (lastProcessed) {
    const found = setNums.indexOf(lastProcessed);
    if (found >= 0) { startIdx = found + 1; console.log(`[bs-sync] resuming after ${lastProcessed} (idx=${startIdx})`); }
  }
  const nowIso = new Date().toISOString();
  const t0 = Date.now();
  let i = startIdx;
  for (; i < setNums.length; i++) {
    const setNum = setNums[i];
    const bs = await getSet(userHash, `${setNum}-1`).catch((e) => { console.warn(`[bs-sync] ${setNum}: ${e.message}`); return null; });
    if (bs) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: [{ PutRequest: { Item: {
          pk: `CATALOG#PRODUCT#${setNum}`,
          sk: "brickset",
          launchPriceUsd: bs.LEGOCom?.US?.retailPrice ?? null,
          launchPriceGbp: bs.LEGOCom?.UK?.retailPrice ?? null,
          launchPriceEur: bs.LEGOCom?.DE?.retailPrice ?? null,
          ageMin: bs.ageRange?.min ?? null,
          ageMax: bs.ageRange?.max ?? null,
          packagingType: bs.packagingType ?? null,
          dimensions: bs.dimensions ?? null,
          source: "brickset",
          updatedAt: nowIso,
        } } }] },
      }));
    }
    if ((i + 1) % PROGRESS_FLUSH_EVERY === 0) {
      await saveProgress(setNum, i + 1);
      console.log(`[bs-sync] ${i + 1}/${setNums.length} (last=${setNum}, ${Math.round((Date.now() - t0) / 1000)}s elapsed)`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  await saveProgress(setNums[setNums.length - 1] ?? null, i);
  console.log(`[bs-sync] DONE: processed ${i - startIdx} sets in ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => { console.error(err); process.exit(1); });
