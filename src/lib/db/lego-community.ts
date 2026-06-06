import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamo, getTableName } from "./dynamo";

/**
 * Live community signal loaders + blender.
 *
 * Reads three optional DDB sources keyed by LEGO setNumber:
 *   - COMMUNITY#<setNumber> / <yyyymm> — Brick Insights aggregate rating
 *     ({ rating: 0-10, reviewCount, source, capturedAt })
 *   - TRENDS#<setNumber>    / <yyyymm> — Google Trends interest 0-100
 *     ({ value: 0-100, term, capturedAt })
 *   - REDDIT#<setNumber>    / <yyyymm> — Reddit mention composite
 *     ({ postCount, totalScore, avgScore, composite, capturedAt })
 *
 * Returns a single blended 0-100 score with graceful degradation: if any
 * source is missing for a set, its weight is redistributed pro-rata to the
 * remaining sources. Returns `null` when all three are unavailable so the
 * caller can fall back to a curated value or show "—".
 */

export interface CommunityComponents {
  brickInsights: number | null; // normalised 0-100 from rating × 10
  trends: number | null; // 0-100 (3-month average of monthly values)
  reddit: number | null; // 0-100 (composite normalised across the cohort)
}

const DEFAULT_WEIGHTS = {
  brickInsights: 0.5,
  trends: 0.25,
  reddit: 0.25,
} as const;

/**
 * Cohort baseline for Reddit normalisation. The raw `composite` is unbounded
 * (it's `postCount × log(avgScore+1)`); to map it to 0-100 we treat values
 * at or above this cohort cap as 100. The cap was chosen empirically against
 * a sample of high-engagement flagship sets (UCS Falcon, Hogwarts Castle)
 * which top out around composite ≈ 200. Update if the cohort distribution
 * shifts materially.
 */
const REDDIT_COMPOSITE_CAP = 200;

async function queryAllForPk(pk: string) {
  const dynamo = getDynamo();
  if (!dynamo) return [];
  const out: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ExclusiveStartKey,
      })
    );
    out.push(...((res.Items ?? []) as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function latestRow<T extends { sk?: unknown; capturedAt?: unknown }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  // SK is yyyymm string; lexicographic sort works.
  return [...rows].sort((a, b) => String(b.sk ?? "").localeCompare(String(a.sk ?? "")))[0];
}

export async function loadCommunityComponents(setNumber: string): Promise<CommunityComponents> {
  const [community, trends, reddit] = await Promise.all([
    queryAllForPk(`COMMUNITY#${setNumber}`).catch(() => []),
    queryAllForPk(`TRENDS#${setNumber}`).catch(() => []),
    queryAllForPk(`REDDIT#${setNumber}`).catch(() => []),
  ]);

  // Brick Insights: latest row's `rating` is 0-10; multiply by 10.
  const ciLatest = latestRow(community as { sk?: unknown; rating?: unknown }[]);
  const rawRating = ciLatest ? toNumber(ciLatest.rating) : null;
  const brickInsights = rawRating == null ? null : Math.max(0, Math.min(100, rawRating * 10));

  // Trends: average of the most recent 3 monthly values (rows are
  // yyyymm-keyed). If we only have 1-2 months, average what we have.
  const trendRows = (trends as { sk?: unknown; value?: unknown }[])
    .slice()
    .sort((a, b) => String(b.sk ?? "").localeCompare(String(a.sk ?? "")))
    .slice(0, 3)
    .map((r) => toNumber(r.value))
    .filter((v): v is number => v != null);
  const trendsScore =
    trendRows.length > 0
      ? Math.max(0, Math.min(100, trendRows.reduce((s, v) => s + v, 0) / trendRows.length))
      : null;

  // Reddit: latest composite mapped to 0-100 via REDDIT_COMPOSITE_CAP.
  const rLatest = latestRow(reddit as { sk?: unknown; composite?: unknown }[]);
  const rawComposite = rLatest ? toNumber(rLatest.composite) : null;
  const redditScore =
    rawComposite == null
      ? null
      : Math.max(0, Math.min(100, (rawComposite / REDDIT_COMPOSITE_CAP) * 100));

  return { brickInsights, trends: trendsScore, reddit: redditScore };
}

/**
 * Blend the three component scores into a single 0-100. Pro-rata weight
 * redistribution: if a component is null its weight is shared across the
 * remaining components in proportion to their default weights. Returns
 * null only when ALL three components are null.
 */
export function blendCommunityScore(c: CommunityComponents): number | null {
  const present = (
    [
      ["brickInsights", c.brickInsights] as const,
      ["trends", c.trends] as const,
      ["reddit", c.reddit] as const,
    ]
  ).filter(([, v]) => v != null) as ["brickInsights" | "trends" | "reddit", number][];

  if (present.length === 0) return null;

  const totalWeight = present.reduce((s, [k]) => s + DEFAULT_WEIGHTS[k], 0);
  const weighted = present.reduce((s, [k, v]) => s + DEFAULT_WEIGHTS[k] * v, 0);
  return Math.round(weighted / totalWeight);
}

export async function computeCommunityScore(setNumber: string): Promise<number | null> {
  const components = await loadCommunityComponents(setNumber);
  return blendCommunityScore(components);
}
