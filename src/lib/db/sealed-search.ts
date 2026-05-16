import "server-only";

import type { SealedProduct } from "@/lib/types/sealed";
import rawCatalog from "@/lib/data/sealed-ml/sealed-catalog.json";

const catalog = rawCatalog as SealedProduct[];

// In-process cache (warm after first call)
let cachedCatalog: SealedProduct[] | null = null;

/**
 * Returns the full bundled LEGO catalog.
 * In a production environment this could be augmented from DynamoDB,
 * but for the MVP we always serve from the committed JSON.
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
