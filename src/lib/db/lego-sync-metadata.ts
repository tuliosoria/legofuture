import "server-only";

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
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

    if (rows.length === 0) return null;

    const sorted = rows
      .map((r) => ({ row: r, ts: rowTimestamp(r) }))
      .filter((r) => r.ts)
      .sort((a, b) => b.ts.localeCompare(a.ts));

    if (sorted.length === 0) return null;

    const preferred =
      sorted.find(({ row }) => isPricechartingRow(row) && rowTotal(row) !== null) ??
      sorted.find(({ row }) => rowTotal(row) !== null);

    if (!preferred) return null;
    const total = rowTotal(preferred.row);
    if (total === null) return null;

    return {
      total,
      syncedAt: preferred.ts,
      source: rowSource(preferred.row),
    };
  } catch (err) {
    console.warn("getLatestSyncMetadata error:", err);
    return null;
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
