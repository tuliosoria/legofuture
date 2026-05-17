export interface PricingProviders {
  pricecharting?: { current?: number | null } | null;
  bricklink?: { newAvg?: number | null; usedAvg?: number | null } | null;
  ebay?: { medianSoldUsd?: number | null } | null;
  brickset?: { launchPriceUsd?: number | null } | null;
}

export function countPricingProviders(p: PricingProviders | null | undefined): number {
  if (!p) return 0;
  let n = 0;
  if (p.pricecharting && typeof p.pricecharting.current === "number") n++;
  if (p.bricklink && (typeof p.bricklink.newAvg === "number" || typeof p.bricklink.usedAvg === "number")) n++;
  if (p.ebay && typeof p.ebay.medianSoldUsd === "number") n++;
  if (p.brickset && typeof p.brickset.launchPriceUsd === "number") n++;
  return n;
}

export interface EligibilityInput { pricingProviderCount?: number }
export function isEligibleForDashboard(item: EligibilityInput): boolean {
  return (item.pricingProviderCount ?? 0) >= 1;
}
