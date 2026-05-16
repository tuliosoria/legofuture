import "server-only";

import type { SealedProduct } from "@/lib/types/sealed";
import rawCatalog from "@/lib/data/sealed-ml/sealed-catalog.json";

const catalog = rawCatalog as SealedProduct[];

let cachedCatalog: SealedProduct[] | null = null;

/**
 * Returns the LegoFuture catalog.
 *
 * Source of truth: DynamoDB table `legofuture-cache` (pk="CATALOG"). The
 * JSON file imported above is regenerated from DynamoDB by
 * `scripts/hydrate-from-dynamo.mjs`, which runs as the `prebuild` step.
 * No mock / hand-edited fallback is used.
 */
export async function loadStoredCatalog(): Promise<SealedProduct[]> {
  if (cachedCatalog) return cachedCatalog;
  cachedCatalog = catalog;
  return cachedCatalog;
}

export function getProductById(id: string): SealedProduct | null {
  return catalog.find((p) => p.id === id) ?? null;
}

export function getProductBySlug(slug: string): SealedProduct | null {
  return catalog.find((p) => p.slug === slug) ?? null;
}
