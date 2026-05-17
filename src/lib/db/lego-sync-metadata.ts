import "server-only";

import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { unstable_cache } from "next/cache";
import { getDynamo, getTableName } from "./dynamo";

/**
 * Reads `META#SYNC_METADATA#*` rows from the `legofuture-cache` DynamoDB
 * table and returns the most recent catalog-size signal.
 *
 * Source rows are written by `scripts/sync-pricecharting-to-dynamo.mjs`:
 *   pk = `META#SYNC_METADATA#<ISO>`
 *   sk = "v1"
 *   { total_products_synced, source: "pricecharting", completed_at, started_at, ... }
 *
 * Preference: rows that look like the pricecharting catalog sync
 * (script === "sync-pricecharting" OR source === "pricecharting") most
 * recent. Fall back to the most recent of any META#SYNC_METADATA row,
 * using `total_products_synced` if present, otherwise `sets_processed`.
 *
 * Returns null when no row exists, when the table env is missing, or
 * when DynamoDB is unreachable.
 */

export interface SyncMetadataSummary {
  total: number;
  syncedAt: string;
  source: string;
}

type Row = Record<string, unknown>;

function pkTimestamp(pk: unknown): string {
  const s = typeof pk === "string" ? pk : "";
  const idx = s.indexOf("META#SYNC_METADATA#");
  return idx === 0 ? s.slice("META#SYNC_METADATA#".length) : "";
}

function rowTimestamp(row: Row): string {
  const completedAt = typeof row.completed_at === "string" ? row.completed_at : "";
  const finishedAt = typeof row.finishedAt === "string" ? row.finishedAt : "";
  const capturedAt = typeof row.capturedAt === "string" ? row.capturedAt : "";
  return completedAt || finishedAt || capturedAt || pkTimestamp(row.pk);
}

function rowTotal(row: Row): number | null {
  const t = row.total_products_synced;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  const s = row.sets_processed;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  return null;
}

function rowSource(row: Row): string {
  const script = typeof row.script === "string" ? row.script : "";
  const source = typeof row.source === "string" ? row.source : "";
  return script || source || "sync-metadata";
}

function isPricechartingRow(row: Row): boolean {
  return row.script === "sync-pricecharting" || row.source === "pricecharting";
}

async function fetchLatestSyncMetadataUncached(): Promise<SyncMetadataSummary | null> {
  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const rows: Row[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await client.send(
        new ScanCommand({
          TableName: table,
          FilterExpression: "begins_with(pk, :prefix)",
          ExpressionAttributeValues: { ":prefix": "META#SYNC_METADATA#" },
          ExclusiveStartKey,
        })
      );
      rows.push(...((res.Items as Row[]) || []));
      ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);

    const sorted = rows
      .map((r) => ({ row: r, ts: rowTimestamp(r) }))
      .filter((r) => r.ts)
      .sort((a, b) => b.ts.localeCompare(a.ts));

    // Prefer the most recent pricecharting catalog sync with a usable
    // (non-zero) total. Some early sync rows recorded a 0-total
    // "limitations" snapshot that we don't want to surface as the
    // tracked-set count. Fall back to the most recent row with a
    // non-zero total of any source, then to a counted CATALOG scan.
    const hasUsableTotal = (row: Row) => {
      const t = rowTotal(row);
      return t !== null && t > 0;
    };
    const preferred =
      sorted.find(({ row }) => isPricechartingRow(row) && hasUsableTotal(row)) ??
      sorted.find(({ row }) => hasUsableTotal(row));

    if (preferred) {
      const total = rowTotal(preferred.row);
      if (total !== null && total > 0) {
        return {
          total,
          syncedAt: preferred.ts,
          source: rowSource(preferred.row),
        };
      }
    }

    // Last-resort fallback: count CATALOG#PRODUCT#* rows directly so
    // the home page never shows "0 LEGO sets tracked" when the catalog
    // is actually populated.
    const catalogTotal = await countCatalogRows(client, table);
    if (catalogTotal > 0) {
      // Use the most recent sync_metadata row's timestamp if available so
      // the "last synced" label still reflects a real event.
      const latestTs = sorted[0]?.ts ?? new Date().toISOString();
      return {
        total: catalogTotal,
        syncedAt: latestTs,
        source: "catalog-row-count",
      };
    }

    return null;
  } catch (err) {
    console.warn("getLatestSyncMetadata error:", err);
    return null;
  }
}

async function countCatalogRows(
  client: NonNullable<ReturnType<typeof getDynamo>>,
  table: string
): Promise<number> {
  try {
    let total = 0;
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await client.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :s)",
          ExpressionAttributeValues: {
            ":pk": "CATALOG",
            ":s": "PRODUCT#",
          },
          Select: "COUNT",
          ExclusiveStartKey,
        })
      );
      total += res.Count ?? 0;
      ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return total;
  } catch {
    return 0;
  }
}

const cachedLatest = unstable_cache(
  fetchLatestSyncMetadataUncached,
  ["lego-sync-metadata:latest"],
  { revalidate: 300, tags: ["lego-sync-metadata"] }
);

export async function getLatestSyncMetadata(): Promise<SyncMetadataSummary | null> {
  return cachedLatest();
}

export async function getLatestCatalogCount(): Promise<number | null> {
  const meta = await getLatestSyncMetadata();
  return meta ? meta.total : null;
}
