#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["BRICKSET_API_KEY", "BRICKSET_USERNAME", "BRICKSET_PASSWORD"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[bs-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const BASE = "https://brickset.com/api/v3.asmx";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bsLogin() {
  const url = `${BASE}/login?apiKey=${process.env.BRICKSET_API_KEY}&username=${encodeURIComponent(process.env.BRICKSET_USERNAME)}&password=${encodeURIComponent(process.env.BRICKSET_PASSWORD)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "success") throw new Error(`Brickset login failed: ${data.message}`);
  return data.hash;
}

async function getSet(userHash, setNum) {
  const params = JSON.stringify({ setNumber: setNum });
  const url = `${BASE}/getSets?apiKey=${process.env.BRICKSET_API_KEY}&userHash=${userHash}&params=${encodeURIComponent(params)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.sets?.[0] || null;
}

async function loadAllSetNums() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item.id);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  const userHash = await bsLogin();
  const setNums = await loadAllSetNums();
  console.log(`[bs-sync] ${setNums.length} sets to enrich`);
  const nowIso = new Date().toISOString();
  let i = 0;
  for (const setNum of setNums) {
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
    i++;
    if (i % 100 === 0) console.log(`[bs-sync] ${i}/${setNums.length}`);
    await sleep(1000);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
