import "server-only";

import { getLatestSyncMetadata } from "@/lib/db/lego-sync-metadata";

interface HeroStatsProps {
  className?: string;
}

/**
 * Renders a live "<N> LEGO sets tracked" pill from the most recent
 * META#SYNC_METADATA#* row, or "Catalog sync pending" when no sync
 * has completed (or DynamoDB is unreachable). Never hard-codes a count.
 */
export async function HeroStats({ className }: HeroStatsProps) {
  const meta = await getLatestSyncMetadata();
  const label = meta
    ? `${meta.total.toLocaleString()} LEGO sets tracked`
    : "Catalog sync pending";

  return (
    <span
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border-2 border-jet-black bg-pure-white px-3 py-1 type-body-sm text-jet-black"
      }
      data-testid="hero-stats-catalog-count"
    >
      <span aria-hidden className="w-2 h-2 rounded-full bg-pure-green" />
      {label}
    </span>
  );
}
