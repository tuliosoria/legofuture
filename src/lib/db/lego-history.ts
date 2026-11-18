import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { HistoryPoint, LegoCondition, LegoSet } from "@/lib/types/lego";
import { getDynamo, getTableName } from "./dynamo";
import { mergeObservedHistory } from "@/lib/domain/observed-history";
import { cacheGet, cachePut } from "./cache";

/**
 * Live monthly price history for a set/condition pair.
 *
 * Source of truth: DynamoDB items with
 *   pk = `HISTORY#PRODUCT#<id>`
 *   sk = `<condition>#<YYYY-MM-DD>`     ({ price: number })
 *
 * Returns `[]` (not null) when no history rows exist — the forecast
 * sparse-data guard will then flag the set as `forecastEligible: false`.
 *
 * 5-minute DDB-backed cache absorbs repeated reads per Lambda invocation.
 */

const HISTORY_CACHE_TYPE = "lego-history";
const HISTORY_TTL_SEC = 300;

function cacheKey(id: string, condition: LegoCondition): string {
  return `${id}#${condition}`;
}

export async function loadHistory(
  product: LegoSet,
  condition: LegoCondition = "new-sealed"
): Promise<HistoryPoint[]> {
  const key = cacheKey(product.id, condition);
  const cached = await cacheGet<HistoryPoint[]>(HISTORY_CACHE_TYPE, key);
  if (cached) return cached;

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return [];

  try {
    const items: Record<string, unknown>[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await client.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression:
            "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: {
            ":pk": `HISTORY#PRODUCT#${product.id}`,
            ":prefix": `${condition}#`,
          },
          ExclusiveStartKey,
        })
      );
      items.push(...((res.Items as Record<string, unknown>[]) || []));
      ExclusiveStartKey = res.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (ExclusiveStartKey);

    const history: HistoryPoint[] = items
      .map((row) => {
        const sk = String(row.sk ?? "");
        const date = sk.split("#")[1] ?? "";
        const price = Number(row.price);
        return { date, price };
      })
      .filter((h) => h.date && Number.isFinite(h.price))
      .sort((a, b) => a.date.localeCompare(b.date));

    const observed: Record<string, unknown>[] = [];
    if (condition === "new-sealed" && product.setNumber) {
      try {
      let cursor: Record<string, unknown> | undefined;
      do {
        const response = await client.send(new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":pk": `PRICING#PRODUCT#${product.setNumber}`, ":prefix": "ebay-history#" },
          ExclusiveStartKey: cursor,
        }));
        observed.push(...(response.Items ?? []));
        cursor = response.LastEvaluatedKey;
      } while (cursor);
      } catch (err) {
        console.warn("loadHistory supplemental eBay history unavailable:", err);
      }
    }
    const merged = mergeObservedHistory(history, observed);
    await cachePut(HISTORY_CACHE_TYPE, key, merged, HISTORY_TTL_SEC);
    return merged;
  } catch (err) {
    console.warn("loadHistory error:", err);
    return [];
  }
}
