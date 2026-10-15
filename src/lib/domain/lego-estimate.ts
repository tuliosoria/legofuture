import "server-only";
import type { LegoSet, ProductPricing } from "@/lib/types/lego";
/** Legacy PC, BrickLink/Brickset and mislabeled Browse rows have no verified
 * publication contract. Preserve storage; do not read old merged caches. */
export function mergePricingRows(_rows: Array<Record<string, unknown>>): { pricing: ProductPricing | null; providerCount: number } {
  void _rows;
  return { pricing: null, providerCount: 0 };
}
export async function getPricingFromDdb(_productOrId: string | LegoSet): Promise<ProductPricing | null> { void _productOrId; return null; }
export async function fetchLivePricing(_product: LegoSet): Promise<ProductPricing | null> { void _product; return null; }
export async function getPricing(_product: LegoSet): Promise<ProductPricing | null> { void _product; return null; }
