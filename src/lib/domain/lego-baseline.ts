import "server-only";

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { LegoSet } from "@/lib/types/lego";
import { getDynamo, getTableName } from "@/lib/db/dynamo";

/**
 * Per-theme median dollars-per-piece, produced by
 * `scripts/build-baseline-pricing.mjs`. Used to synthesize a current price for
 * sets that lack any external marketplace data so the dashboard can still
 * render a meaningful forecast.
 *
 * Bucketed by retirement status because retired sets carry a structural
 * premium over current ones. Falls back to the per-theme overall median, then
 * to a global median.
 */
export interface PricingBaseline {
  version: number;
  builtAt: string;
  sampleCount: number;
  themeCount: number;
  globalDollarsPerPiece: number | null;
  retiredDollarsPerPiece: number | null;
  currentDollarsPerPiece: number | null;
  themes: Record<
    string,
    {
      retired?: { dollarsPerPiece: number; sampleCount: number };
      current?: { dollarsPerPiece: number; sampleCount: number };
      any?: { dollarsPerPiece: number; sampleCount: number };
    }
  >;
}

const BASELINE_KEY = { pk: "META#PRICING_BASELINE", sk: "v1" } as const;
const MEM_TTL_MS = 10 * 60 * 1000;
let memCache: { data: PricingBaseline | null; expiresAt: number } | null = null;

export function clearBaselineCache(): void {
  memCache = null;
}

export async function loadBaseline(): Promise<PricingBaseline | null> {
  if (memCache && memCache.expiresAt > Date.now()) return memCache.data;

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const res = await client.send(
      new GetCommand({ TableName: table, Key: BASELINE_KEY })
    );
    const item = res.Item as Record<string, unknown> | undefined;
    const data: PricingBaseline | null = item
      ? {
          version: Number(item.version ?? 0),
          builtAt: String(item.builtAt ?? ""),
          sampleCount: Number(item.sampleCount ?? 0),
          themeCount: Number(item.themeCount ?? 0),
          globalDollarsPerPiece: numOrNull(item.globalDollarsPerPiece),
          retiredDollarsPerPiece: numOrNull(item.retiredDollarsPerPiece),
          currentDollarsPerPiece: numOrNull(item.currentDollarsPerPiece),
          themes: (item.themes as PricingBaseline["themes"]) ?? {},
        }
      : null;
    memCache = { data, expiresAt: Date.now() + MEM_TTL_MS };
    return data;
  } catch (err) {
    console.warn("loadBaseline error:", err);
    return null;
  }
}

function numOrNull(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Estimate a current price for a set using piece count × the most specific
 * available median dollars-per-piece for its theme bucket. Returns null when
 * the input lacks usable piece count or the baseline has no data.
 *
 * Lookup precedence:
 *   1. themes[theme][retired|current]      — exact bucket
 *   2. themes[theme].any                   — per-theme fallback
 *   3. retiredDollarsPerPiece | currentDollarsPerPiece — status-only fallback
 *   4. globalDollarsPerPiece               — last-resort
 */
export function synthesizeBaselinePrice(
  product: Pick<LegoSet, "pieceCount" | "theme" | "retired">,
  baseline: PricingBaseline | null
): number | null {
  if (!baseline) return null;
  const pieces = Number(product.pieceCount);
  if (!Number.isFinite(pieces) || pieces <= 0) return null;

  const themeKey = String(product.theme || "");
  const statusKey: "retired" | "current" = product.retired ? "retired" : "current";

  const themeBucket = baseline.themes?.[themeKey];
  const dpp =
    themeBucket?.[statusKey]?.dollarsPerPiece ??
    themeBucket?.any?.dollarsPerPiece ??
    (product.retired
      ? baseline.retiredDollarsPerPiece
      : baseline.currentDollarsPerPiece) ??
    baseline.globalDollarsPerPiece;

  if (dpp === null || dpp === undefined || !Number.isFinite(dpp) || dpp <= 0) {
    return null;
  }
  // Round to the nearest cent to keep cache keys stable
  return Math.round(pieces * dpp * 100) / 100;
}
