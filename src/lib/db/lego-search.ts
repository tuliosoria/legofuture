import "server-only";

import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { LegoSet } from "@/lib/types/lego";
import { eraFor, coerceTheme } from "@/lib/data/lego-themes";
import { getDynamo, getTableName } from "./dynamo";
import { isEligibleForDashboard } from "@/lib/domain/lego-catalog-eligibility";
import { inferProductType } from "@/lib/domain/lego-product-classifier";
import gwpDenylistData from "@/lib/data/lego-ml/lego-catalog-gwp-denylist.json";
import catalogOverridesData from "@/lib/data/lego-ml/lego-catalog-overrides.json";

/**
 * Source of truth for the LegoFuture catalog: DynamoDB table
 * `legofuture-cache`, partition `pk="CATALOG"`, sort key `sk="PRODUCT#<id>"`.
 * Populated by `scripts/sync-pricecharting-to-dynamo.mjs`.
 *
 * Reads are live per request. The DDB-backed two-layer cache (cache.ts)
 * absorbs repeated reads so each Lambda invocation pays at most one
 * DynamoDB Query for the full catalog, with a 5-minute TTL.
 *
 * After loading from DDB we apply (in order):
 *   1. GWP denylist + `isNonRetailSetId` heuristic — drop promo/GWP sets
 *   2. Catalog overrides (shallow-merge, last-wins) from local JSON
 *   3. Computed fields: `setNumberPrefix` + `era`
 */

const GWP_DENYLIST: ReadonlySet<string> = new Set(gwpDenylistData as string[]);

type CatalogOverride = Partial<
  Pick<LegoSet, "name" | "imageUrl" | "retirementYear" | "retired" | "theme" | "productType" | "investmentUniverse">
>;
const CATALOG_OVERRIDES = catalogOverridesData as Record<string, CatalogOverride>;

const NON_RETAIL_NAME_PATTERNS = [
  /\bGWP\b/i,
  /\bgift with purchase\b/i,
  /\bpromo\b/i,
  /\bemployee\b/i,
  /\bsdcc\b/i,
  /\bcomic con\b/i,
  /\bpolybag\b/i,
  /\bpolybag exclusive\b/i,
  // Gear / merchandise — not investable sealed-box sets
  /\bkey\s?chain\b/i,
  /\bkey\s?ring\b/i,
  /\bplush(ie)?\b/i,
  /\bpencil\s+case\b/i,
  /\backpack\b/i,
  /\blanyard\b/i,
  /\bflip[\s-]?flop/i,
  /\balarm\s+clock\b/i,
  /\bsticker\s+book\b/i,
  /\bactivity\s+book\b/i,
  /\b(?:colouring|coloring)\s+book\b/i,
  /\bbandmates\b/i,
  /\bbuildable\s+watch\b/i,
  /\bdigital\s+watch\b/i,
  /\bwatch\s+face\b/i,
];

export function isNonRetailSetId(set: {
  id?: string;
  setNumber?: string;
  name?: string;
}): boolean {
  if (set.name && NON_RETAIL_NAME_PATTERNS.some((rx) => rx.test(set.name!))) {
    return true;
  }
  // Note: prefix-based heuristic intentionally NOT applied by default because
  // theme 30/40 prefixes are widely used legitimately. Only the explicit
  // denylist + name patterns gate.
  return false;
}

function computeSetNumberPrefix(setNumber: string | undefined): string | undefined {
  if (!setNumber) return undefined;
  const match = setNumber.match(/^(\d{2,3})/);
  return match ? match[1] : undefined;
}

function applyOverridesAndComputed(set: LegoSet): LegoSet {
  const override = CATALOG_OVERRIDES[set.id];
  const merged: LegoSet = override ? { ...set, ...override } : { ...set };
  // Coerce theme through registry so unknown strings collapse to "Other"
  merged.theme = coerceTheme(merged.theme as unknown as string);
  merged.setNumberPrefix = computeSetNumberPrefix(merged.setNumber);
  merged.era = eraFor(merged.theme);
  // Infer productType unless already set by override
  if (!merged.productType) {
    merged.productType = inferProductType(merged.name, merged.setNumber, merged.pieceCount);
  }
  if (merged.retired && merged.retirementYear === undefined) {
    merged.retirementYear = merged.retirementYear ?? null;
  } else if (merged.retired === false && merged.retirementYear === undefined) {
    merged.retirementYear = null;
  }
  return merged;
}

function stripKeys(item: Record<string, unknown>): LegoSet {
  const { pk: _pk, sk: _sk, ...rest } = item;
  void _pk;
  void _sk;
  return rest as unknown as LegoSet;
}

function deriveSlug(name: string | undefined, id: string): string {
  const base = (name ?? id).toString().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base ? `${base}-${id}` : id;
}

/**
 * Normalize a raw DDB row from any sync source (PriceCharting, Rebrickable,
 * Brickset, etc.) into a `LegoSet`. Returns null when row lacks the
 * minimum fields to render.
 */
function normalizeStoredRow(item: Record<string, unknown>): LegoSet | null {
  const id = (item.id as string | undefined) ?? undefined;
  if (!id) return null;

  // Rebrickable shape: { id, name, year, themeName, pieceCount, imageUrl }
  // PriceCharting shape: { id, productName, consoleName, releaseDate, raw }
  const pcRaw = (item.raw as Record<string, unknown> | undefined) ?? undefined;
  const consoleName = (item.consoleName as string | undefined)
    ?? (pcRaw?.["console-name"] as string | undefined);

  const name = (item.name as string | undefined)
    ?? (item.productName as string | undefined)
    ?? (pcRaw?.["product-name"] as string | undefined)
    ?? `Set ${id}`;

  const setNumber = (item.setNumber as string | undefined)
    ?? id;

  const releaseDateStr = (item.releaseDate as string | undefined)
    ?? (pcRaw?.["release-date"] as string | undefined);
  const releaseYear = (item.releaseYear as number | undefined)
    ?? (typeof item.year === "number" ? (item.year as number) : undefined)
    ?? (releaseDateStr ? Number(releaseDateStr.slice(0, 4)) : undefined)
    ?? 0;

  const themeRaw = (item.theme as string | undefined)
    ?? (item.themeName as string | undefined)
    ?? (consoleName ? consoleName.replace(/^LEGO\s+/i, "") : undefined)
    ?? "Other";

  const set: LegoSet = {
    id,
    setNumber,
    name,
    theme: themeRaw as LegoSet["theme"],
    releaseYear,
    retired: (item.retired as boolean | undefined) ?? false,
    retirementYear: (item.retirementYear as number | null | undefined) ?? null,
    pieceCount: (item.pieceCount as number | undefined) ?? 0,
    minifigCount: (item.minifigCount as number | undefined) ?? 0,
    originalMsrp: (item.originalMsrp as number | undefined) ?? 0,
    imageUrl: (item.imageUrl as string | undefined) ?? "",
    slug: (item.slug as string | undefined) ?? deriveSlug(name, id),
    enrichmentStatus: item.enrichmentStatus as LegoSet["enrichmentStatus"],
    pricingProviderCount: (item.pricingProviderCount as number | undefined) ?? 0,
    soldComps90d: typeof item.soldComps90d === "number" ? (item.soldComps90d as number) : undefined,
  };
  return set;
}

/**
 * The old hard cap (500) has been replaced with the `orphanCap` parameter.
 * The /api/sets/catalog route omits the cap and handles pagination server-side.
 * Legacy SSR callers (set-forecast/page.tsx) pass SSR_ORPHAN_CAP=200 to prevent
 * Lambda timeouts until GSI-based pagination is available (Plan C / TODO(GSI)).
 * @deprecated Pass `orphanCap` explicitly; prefer /api/sets/catalog for pagination.
 */

export async function loadStoredCatalog(opts?: {
  includeOrphans?: boolean;
  /**
   * Maximum orphan (Rebrickable-only) rows to return. Defaults to no cap.
   * Pass a conservative value (e.g. 200) in SSR contexts to avoid timeouts.
   * @deprecated Prefer /api/sets/catalog (Plan C) for paginated access.
   */
  orphanCap?: number;
}): Promise<LegoSet[]> {
  const ddb = getDynamo();
  const table = getTableName();
  if (!ddb || !table) {
    throw new Error("DynamoDB not configured (DYNAMODB_TABLE env var missing).");
  }
  const includeOrphans = opts?.includeOrphans === true;
  const all: LegoSet[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    // When orphans are NOT requested, push the eligibility filter into the
    // Scan via a FilterExpression so we don't materialize 27K rows in the
    // Lambda. DDB still reads every row (no GSI yet — Plan C) but only
    // returns matches over the wire.
    const filterParts = ["begins_with(pk, :p)", "sk = :sk"];
    const eav: Record<string, unknown> = { ":p": "CATALOG#PRODUCT#", ":sk": "v1" };
    if (!includeOrphans) {
      filterParts.push("attribute_exists(pricingProviderCount) AND pricingProviderCount >= :one");
      eav[":one"] = 1;
    }
    const res = await ddb.send(new ScanCommand({
      TableName: table,
      FilterExpression: filterParts.join(" AND "),
      ExpressionAttributeValues: eav,
      ExclusiveStartKey,
      Limit: 1000,
    }));
    for (const item of res.Items || []) {
      const normalized = normalizeStoredRow(item as Record<string, unknown>);
      if (!normalized) continue;
      if (GWP_DENYLIST.has(normalized.id) || isNonRetailSetId(normalized)) continue;
      all.push(applyOverridesAndComputed(normalized));
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    const cap = opts?.orphanCap;
    if (includeOrphans && cap !== undefined && all.length >= cap) break;
  } while (ExclusiveStartKey);

  const cap = opts?.orphanCap;
  if (includeOrphans) return cap !== undefined ? all.slice(0, cap) : all;
  return all.filter(isEligibleForDashboard);
}

export async function getProductById(id: string): Promise<LegoSet | null> {
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
    const set = stripKeys(res.Item as Record<string, unknown>);
    if (GWP_DENYLIST.has(set.id) || isNonRetailSetId(set)) return null;
    return applyOverridesAndComputed(set);
  } catch (err) {
    console.warn("getProductById error:", err);
    return null;
  }
}

export async function getProductBySlug(
  slug: string
): Promise<LegoSet | null> {
  const catalog = await loadStoredCatalog();
  return catalog.find((p) => p.slug === slug) ?? null;
}
