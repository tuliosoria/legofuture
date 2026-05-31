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

export interface EligibilityInput {
  pricingProviderCount?: number;
  pieceCount?: number;
  originalMsrp?: number;
}

export function isEligibleForDashboard(item: EligibilityInput): boolean {
  if ((item.pricingProviderCount ?? 0) < 1) return false;
  // Exclude accessories and merchandise: require a meaningful set size or retail price.
  // Most LEGO gear (keychains, magnets, watches, mini-bags) has 0–10 pieces and <$15 MSRP.
  const hasPieces = (item.pieceCount ?? 0) >= 30;
  const hasMsrp = (item.originalMsrp ?? 0) >= 15;
  return hasPieces || hasMsrp;
}
