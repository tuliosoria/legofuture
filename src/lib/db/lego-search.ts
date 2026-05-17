import "server-only";

import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { LegoSet } from "@/lib/types/lego";
import { eraFor, coerceTheme } from "@/lib/data/lego-themes";
import { getDynamo, getTableName } from "./dynamo";
import { cacheGet, cachePut } from "./cache";
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

const CATALOG_CACHE_TYPE = "lego-catalog";
const CATALOG_CACHE_KEY = "v1";
const CATALOG_TTL_SEC = 300;

const GWP_DENYLIST: ReadonlySet<string> = new Set(gwpDenylistData as string[]);

type CatalogOverride = Partial<
  Pick<LegoSet, "name" | "imageUrl" | "retirementYear" | "retired" | "theme">
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

async function fetchCatalogFromDdb(): Promise<LegoSet[]> {
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

export async function loadStoredCatalog(): Promise<LegoSet[]> {
  const cached = await cacheGet<LegoSet[]>(
    CATALOG_CACHE_TYPE,
    CATALOG_CACHE_KEY
  );
  if (cached) return cached;

  const raw = await fetchCatalogFromDdb();
  const filtered = raw.filter(
    (set) => !GWP_DENYLIST.has(set.id) && !isNonRetailSetId(set)
  );
  const fresh = filtered.map(applyOverridesAndComputed);
  await cachePut(CATALOG_CACHE_TYPE, CATALOG_CACHE_KEY, fresh, CATALOG_TTL_SEC);
  return fresh;
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
