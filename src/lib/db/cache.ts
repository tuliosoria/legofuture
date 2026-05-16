import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamo, getTableName } from "./dynamo";

/**
 * Two-layer cache: in-memory (L1) + DynamoDB (L2).
 * If DYNAMODB_TABLE is not set, only L1 is used (graceful degradation).
 */

const memCache = new Map<string, { data: unknown; expires: number }>();
const MEM_MAX = 300;
const FALLBACK_MEM_TTL_MS = 5 * 60 * 1000;

function memClean() {
  const now = Date.now();
  for (const [k, v] of memCache) {
    if (v.expires < now) memCache.delete(k);
  }
  if (memCache.size > MEM_MAX) {
    const sorted = [...memCache.entries()].sort(
      (a, b) => a[1].expires - b[1].expires
    );
    for (let i = 0; i < sorted.length - MEM_MAX; i++) {
      memCache.delete(sorted[i][0]);
    }
  }
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function buildCompositeCacheKey(type: string, key: string): string {
  return `${base64Url(type)}.${base64Url(key)}`;
}

export function isExpiredTtlEpochSeconds(
  ttl: unknown,
  nowSec: number
): boolean {
  return typeof ttl === "number" && Number.isFinite(ttl) && ttl <= nowSec;
}

function l1ExpiresMs(ttl: unknown): number {
  if (typeof ttl === "number" && Number.isFinite(ttl)) {
    return ttl * 1000;
  }
  return Date.now() + FALLBACK_MEM_TTL_MS;
}

export async function cacheGet<T>(type: string, key: string): Promise<T | null> {
  const ck = buildCompositeCacheKey(type, key);

  const mem = memCache.get(ck);
  if (mem && mem.expires > Date.now()) {
    return mem.data as T;
  }
  if (mem) memCache.delete(ck);

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const result = await client.send(
      new GetCommand({
        TableName: table,
        Key: { pk: `CACHE#${type}`, sk: key },
      })
    );

    if (!result.Item) return null;

    const ttl = result.Item.ttl;
    const nowSec = Math.floor(Date.now() / 1000);
    if (isExpiredTtlEpochSeconds(ttl, nowSec)) return null;

    let data: T;
    try {
      data = JSON.parse(result.Item.data as string) as T;
    } catch {
      return null;
    }

    memCache.set(ck, { data, expires: l1ExpiresMs(ttl) });
    return data;
  } catch (err) {
    console.warn("DynamoDB cache get error:", err);
    return null;
  }
}

export async function cachePut(
  type: string,
  key: string,
  data: unknown,
  ttlSeconds = 1800
): Promise<void> {
  const ck = buildCompositeCacheKey(type, key);
  const expiresMs = Date.now() + ttlSeconds * 1000;
  const ttlEpoch = Math.floor(expiresMs / 1000);

  memClean();
  memCache.set(ck, { data, expires: expiresMs });

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return;

  try {
    await client.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `CACHE#${type}`,
          sk: key,
          data: JSON.stringify(data),
          ttl: ttlEpoch,
          createdAt: new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    console.warn("DynamoDB cache put error:", err);
  }
}
