import type { SealedProduct, ProductPricing } from "@/lib/types/sealed";
import pricingData from "@/lib/data/sealed-ml/pricecharting-current-prices.json";

type PricingMap = Record<string, ProductPricing>;

/**
 * Pricing snapshot. Source of truth: DynamoDB table `legofuture-cache`
 * (pk="PRICING"), populated by `scripts/sync-pricecharting-to-dynamo.mjs`.
 * The JSON file imported above is regenerated from DynamoDB at prebuild
 * by `scripts/hydrate-from-dynamo.mjs`. No mock fallback.
 */
const hydratedPricing = pricingData as unknown as PricingMap;

const memCache = new Map<string, { data: ProductPricing; expiresAt: number }>();
const MEM_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the latest pricing snapshot for a product from the hydrated
 * (DynamoDB-sourced) dataset. Returns null only if PriceCharting had no
 * data at the last sync.
 */
export function getPricingFromBundle(id: string): ProductPricing | null {
  return hydratedPricing[id] ?? null;
}

export async function fetchLivePricing(
  product: SealedProduct
): Promise<ProductPricing | null> {
  const token = process.env.PRICECHARTING_API_TOKEN;
  if (!token) return null;

  const cached = memCache.get(product.id);
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

    memCache.set(product.id, { data: pricing, expiresAt: Date.now() + MEM_TTL_MS });
    return pricing;
  } catch {
    return null;
  }
}

export async function getPricing(
  product: SealedProduct
): Promise<ProductPricing | null> {
  // L0: in-process cache
  const mem = memCache.get(product.id);
  if (mem && mem.expiresAt > Date.now()) return mem.data;

  // L2: bundled JSON
  const bundle = getPricingFromBundle(product.id);
  if (bundle) return bundle;

  // L3: live PriceCharting
  return fetchLivePricing(product);
}
