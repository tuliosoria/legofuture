import "server-only";

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { SealedProduct, ProductPricing } from "@/lib/types/sealed";
import { getDynamo, getTableName } from "@/lib/db/dynamo";
import { cacheGet, cachePut } from "@/lib/db/cache";

/**
 * Pricing snapshot. Source of truth: DynamoDB table `legofuture-cache`
 * (pk="PRICING", sk="PRODUCT#<id>"), populated by
 * `scripts/sync-pricecharting-to-dynamo.mjs`. Reads are live per request,
 * with a 5-minute DDB-backed cache (cache.ts) to absorb repeated hits.
 */

const PRICING_CACHE_TYPE = "lego-pricing";
const PRICING_TTL_SEC = 300;
const MEM_TTL_MS = 5 * 60 * 1000;

const liveMemCache = new Map<string, { data: ProductPricing; expiresAt: number }>();

export async function getPricingFromDdb(
  id: string
): Promise<ProductPricing | null> {
  const cached = await cacheGet<ProductPricing>(PRICING_CACHE_TYPE, id);
  if (cached) return cached;

  const client = getDynamo();
  const table = getTableName();
  if (!client || !table) return null;

  try {
    const res = await client.send(
      new GetCommand({
        TableName: table,
        Key: { pk: "PRICING", sk: `PRODUCT#${id}` },
      })
    );
    if (!res.Item) return null;

    const {
      pk: _pk,
      sk: _sk,
      productId: _productId,
      _source,
      ...fields
    } = res.Item as Record<string, unknown>;
    void _pk;
    void _sk;
    void _productId;
    void _source;

    const pricing = fields as unknown as ProductPricing;
    await cachePut(PRICING_CACHE_TYPE, id, pricing, PRICING_TTL_SEC);
    return pricing;
  } catch (err) {
    console.warn("getPricingFromDdb error:", err);
    return null;
  }
}

export async function fetchLivePricing(
  product: SealedProduct
): Promise<ProductPricing | null> {
  const token = process.env.PRICECHARTING_API_TOKEN;
  if (!token) return null;

  const cached = liveMemCache.get(product.id);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const q = encodeURIComponent(
    `LEGO ${product.setNumber} ${product.name}`
  );
  const url = `https://www.pricecharting.com/api/product?t=${token}&q=${q}&genre=LEGO+Set`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data.status !== "success") return null;

    const pricing: ProductPricing = {
      newPrice: data["new-price"] ? Math.round(data["new-price"]) / 100 : null,
      cibPrice: data["cib-price"] ? Math.round(data["cib-price"]) / 100 : null,
      loosePrice: data["loose-price"] ? Math.round(data["loose-price"]) / 100 : null,
      salesVolume: data["sales-volume"] ?? null,
      lastFetched: new Date().toISOString(),
    };

    liveMemCache.set(product.id, {
      data: pricing,
      expiresAt: Date.now() + MEM_TTL_MS,
    });
    return pricing;
  } catch {
    return null;
  }
}

/**
 * Preferred per-request pricing resolver. Returns DynamoDB snapshot
 * (refreshed by the sync script) and falls back to live PriceCharting
 * only when DDB has no record.
 */
export async function getPricing(
  product: SealedProduct
): Promise<ProductPricing | null> {
  const ddb = await getPricingFromDdb(product.id);
  if (ddb) return ddb;
  return fetchLivePricing(product);
}
