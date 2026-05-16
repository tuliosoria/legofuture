import "server-only";

import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { SealedProduct } from "@/lib/types/sealed";
import { getDynamo, getTableName } from "./dynamo";
import { cacheGet, cachePut } from "./cache";

/**
 * Source of truth for the LegoFuture catalog: DynamoDB table
 * `legofuture-cache`, partition `pk="CATALOG"`, sort key `sk="PRODUCT#<id>"`.
 * Populated by `scripts/sync-pricecharting-to-dynamo.mjs`.
 *
 * Reads are live per request. The DDB-backed two-layer cache (cache.ts)
 * absorbs repeated reads so each Lambda invocation pays at most one
 * DynamoDB Query for the full catalog, with a 5-minute TTL.
 */

const CATALOG_CACHE_TYPE = "lego-catalog";
const CATALOG_CACHE_KEY = "v1";
const CATALOG_TTL_SEC = 300;

function stripKeys(item: Record<string, unknown>): SealedProduct {
  const { pk: _pk, sk: _sk, ...rest } = item;
  void _pk;
  void _sk;
  return rest as unknown as SealedProduct;
}

async function fetchCatalogFromDdb(): Promise<SealedProduct[]> {
  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) {
    throw new Error(
      "DynamoDB not configured (DYNAMODB_TABLE env var missing)."
    );
  }

  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "CATALOG" },
        ExclusiveStartKey,
      })
    );
    items.push(...((res.Items as Record<string, unknown>[]) || []));
    ExclusiveStartKey = res.LastEvaluatedKey as
      | Record<string, unknown>
      | undefined;
  } while (ExclusiveStartKey);

  return items.map(stripKeys).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadStoredCatalog(): Promise<SealedProduct[]> {
  const cached = await cacheGet<SealedProduct[]>(
    CATALOG_CACHE_TYPE,
    CATALOG_CACHE_KEY
  );
  if (cached) return cached;

  const fresh = await fetchCatalogFromDdb();
  await cachePut(CATALOG_CACHE_TYPE, CATALOG_CACHE_KEY, fresh, CATALOG_TTL_SEC);
  return fresh;
}

export async function getProductById(id: string): Promise<SealedProduct | null> {
  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const res = await client.send(
      new GetCommand({
        TableName: table,
        Key: { pk: "CATALOG", sk: `PRODUCT#${id}` },
      })
    );
    if (!res.Item) return null;
    return stripKeys(res.Item as Record<string, unknown>);
  } catch (err) {
    console.warn("getProductById error:", err);
    return null;
  }
}

export async function getProductBySlug(
  slug: string
): Promise<SealedProduct | null> {
  const catalog = await loadStoredCatalog();
  return catalog.find((p) => p.slug === slug) ?? null;
}
