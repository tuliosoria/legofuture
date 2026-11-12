import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { LegoSet, ProductPricing } from "@/lib/types/lego";
import { getDynamo, getTableName } from "@/lib/db/dynamo";
import { cacheGet, cachePut } from "@/lib/db/cache";

/**
 * Pricing snapshot resolver. Sources currently supported, in merge precedence:
 *   0. eBay median     — `refresh-ebay-prices.mjs` writes
 *      `pk=PRICING#PRODUCT#{setNumber}, sk=ebay-median` with `price` (dollars).
 *      Current price since November 2026; the PriceCharting rows below are the
 *      May 2026 snapshot, kept as history (the subscription is cancelled).
 *   1. PriceCharting   — `sync-pricecharting-to-dynamo.mjs` writes
 *      `pk=PRICING#PRODUCT#{pcId}, sk=v1` with fields "new-price" / "cib-price" / "loose-price"
 *   2. BrickLink (new) — `sync-bricklink-pricing.mjs` writes
 *      `pk=PRICING#PRODUCT#{setNumber}, sk=bricklink` with newAvg/usedAvg
 *   3. BrickLink (used) — same row as #2, but used as fallback for cibPrice
 *   4. Brickset        — `sync-brickset-enrichment.mjs` writes
 *      `pk=PRICING#PRODUCT#{setNumber}, sk=brickset` with currentValueNew/currentValueUsed
 *   5. eBay sold       — `sync-ebay-sold-listings.mjs` writes
 *      `pk=PRICING#PRODUCT#{setNumber}, sk=ebay-sold` with avgSoldPrice
 *
 * Calls Query on both `PRICING#PRODUCT#{id}` (PC) and `PRICING#PRODUCT#{setNumber}`
 * (other sources keyed by LEGO set number). Cached for 5 minutes per product.
 */

const PRICING_CACHE_TYPE = "lego-pricing-merged-v3";
const PRICING_TTL_SEC = 300;

interface MergedPricingResult {
  pricing: ProductPricing | null;
  providerCount: number;
}

function num(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Merge PRICING# rows from one DDB partition into a single ProductPricing.
 * Precedence: eBay median > PC > BL-new > BL-used > Brickset > eBay-sold.
 * Returns null when no source contributed a non-null price.
 */
export function mergePricingRows(
  rows: Array<Record<string, unknown>>
): MergedPricingResult {
  let newPrice: number | null = null;
  let cibPrice: number | null = null;
  let loosePrice: number | null = null;
  let salesVolume: number | null = null;
  const sources = new Set<string>();

  // eBay median (sk='ebay-median') — the current price, already vetted by the
  // refresh policy (>= 8 listings, within 0.5x–2x of the last known price).
  const ebayMedianRow = rows.find((r) => r.sk === "ebay-median");
  const ebayMedian = ebayMedianRow ? num(ebayMedianRow.price) : null;
  if (ebayMedian !== null && ebayMedian > 0) {
    newPrice = ebayMedian;
    sources.add("ebay-median");
  }

  // PC row first (sk='v1'); store PC field names verbatim
  const pcRow = rows.find((r) => r.sk === "v1");
  if (pcRow) {
    const np = num(pcRow["new-price"]);
    const cp = num(pcRow["cib-price"]);
    const lp = num(pcRow["loose-price"]);
    if (np !== null && newPrice === null) { newPrice = np / 100; sources.add("pricecharting"); }
    if (cp !== null) { cibPrice = cp / 100; sources.add("pricecharting"); }
    if (lp !== null) { loosePrice = lp / 100; sources.add("pricecharting"); }
  }

  // BrickLink (sk='bricklink')
  const blRow = rows.find((r) => r.sk === "bricklink");
  if (blRow) {
    const na = num(blRow.newAvg);
    const ua = num(blRow.usedAvg);
    if (na !== null) {
      if (newPrice === null) newPrice = na;
      sources.add("bricklink-new");
    }
    if (ua !== null) {
      if (cibPrice === null) cibPrice = ua;
      if (loosePrice === null) loosePrice = ua;
      sources.add("bricklink-used");
    }
  }

  // Brickset (sk='brickset')
  const bsRow = rows.find((r) => r.sk === "brickset");
  if (bsRow) {
    const cvn = num(bsRow.currentValueNew);
    const cvu = num(bsRow.currentValueUsed);
    if (cvn !== null) {
      if (newPrice === null) newPrice = cvn;
      sources.add("brickset");
    }
    if (cvu !== null) {
      if (cibPrice === null) cibPrice = cvu;
      sources.add("brickset");
    }
  }

  // eBay sold (sk='ebay-sold')
  const ebRow = rows.find((r) => r.sk === "ebay-sold");
  if (ebRow) {
    const avg = num(ebRow.avgSoldPrice);
    const vol = num(ebRow.soldCount);
    if (avg !== null) {
      if (newPrice === null) newPrice = avg;
      sources.add("ebay-sold");
    }
    if (vol !== null && salesVolume === null) salesVolume = vol;
  }

  if (newPrice === null && cibPrice === null && loosePrice === null) {
    return { pricing: null, providerCount: 0 };
  }

  const lastFetched =
    (ebayMedian !== null && ebayMedian > 0
      ? (ebayMedianRow?.capturedAt as string | undefined)
      : undefined) ??
    (pcRow?.updatedAt as string | undefined) ??
    (blRow?.capturedAt as string | undefined) ??
    (bsRow?.capturedAt as string | undefined) ??
    (ebRow?.capturedAt as string | undefined) ??
    new Date().toISOString();

  return {
    pricing: { newPrice, cibPrice, loosePrice, salesVolume, lastFetched },
    providerCount: sources.size,
  };
}

/**
 * Query all PRICING#PRODUCT#{key} rows from DDB and merge them.
 * Will combine results from both `id` (PC internal id) and `setNumber`
 * (LEGO standard set number) partitions when both are available.
 */
export async function getPricingFromDdb(
  productOrId: string | LegoSet
): Promise<ProductPricing | null> {
  const id = typeof productOrId === "string" ? productOrId : productOrId.id;
  const setNumber = typeof productOrId === "string"
    ? undefined
    : productOrId.setNumber;

  const cacheKey = setNumber && setNumber !== id ? `${id}|${setNumber}` : id;
  const cached = await cacheGet<ProductPricing>(PRICING_CACHE_TYPE, cacheKey);
  if (cached) return cached;

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const partitions = [`PRICING#PRODUCT#${id}`];
    if (setNumber && setNumber !== id) {
      partitions.push(`PRICING#PRODUCT#${setNumber}`);
    }
    const allRows: Array<Record<string, unknown>> = [];
    await Promise.all(
      partitions.map(async (pk) => {
        const res = await client.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: { ":pk": pk },
          })
        );
        for (const item of res.Items ?? []) {
          allRows.push(item as Record<string, unknown>);
        }
      })
    );
    if (allRows.length === 0) return null;

    const { pricing } = mergePricingRows(allRows);
    if (!pricing) return null;

    await cachePut(PRICING_CACHE_TYPE, cacheKey, pricing, PRICING_TTL_SEC);
    return pricing;
  } catch (err) {
    console.warn("getPricingFromDdb error:", err);
    return null;
  }
}

/**
 * Preferred per-request pricing resolver: the DynamoDB snapshot, refreshed
 * daily from eBay by `scripts/refresh-ebay-prices.mjs`.
 */
export async function getPricing(
  product: LegoSet
): Promise<ProductPricing | null> {
  return getPricingFromDdb(product);
}
