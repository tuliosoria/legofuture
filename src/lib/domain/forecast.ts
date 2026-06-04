import type { LegoSet } from "@/lib/domain/lego-set";

/** S&P 500 long-run nominal annual return assumption. */
export const SP500_ANNUAL = 0.105;

/** Percent return over the 5yr horizon, base case. */
export function roiPercent(set: Pick<LegoSet, "currentPrice" | "proj5y">): number {
  if (set.currentPrice <= 0) return 0;
  return ((set.proj5y - set.currentPrice) / set.currentPrice) * 100;
}

/** Annualised CAGR over 5 years from currentPrice → proj5y. */
export function cagr5(set: Pick<LegoSet, "currentPrice" | "proj5y">): number {
  if (set.currentPrice <= 0 || set.proj5y <= 0) return 0;
  return Math.pow(set.proj5y / set.currentPrice, 1 / 5) - 1;
}

/** Human label like "+18.3%/yr" with sign. */
export function annualRoiLabel(set: Pick<LegoSet, "currentPrice" | "proj5y">): string {
  const r = cagr5(set) * 100;
  const sign = r >= 0 ? "+" : "";
  return `${sign}${r.toFixed(1)}%/yr`;
}

function dotsFromBuckets(value: number, thresholds: [number, number, number, number]): 1 | 2 | 3 | 4 | 5 {
  // thresholds is ascending; value above thresholds[i] means at least (i+2) dots
  if (value >= thresholds[3]) return 5;
  if (value >= thresholds[2]) return 4;
  if (value >= thresholds[1]) return 3;
  if (value >= thresholds[0]) return 2;
  return 1;
}

/** 5yr outlook dots — higher CAGR → more dots. */
export function outlookDots(set: Pick<LegoSet, "currentPrice" | "proj5y">): 1 | 2 | 3 | 4 | 5 {
  const c = cagr5(set);
  return dotsFromBuckets(c, [0.0, 0.05, 0.10, 0.18]);
}

/** Retirement-status dots — Retired > Retiring soon > Active. */
export function retirementDots(set: Pick<LegoSet, "status">): 1 | 2 | 3 | 4 | 5 {
  if (set.status === "Retired") return 5;
  if (set.status === "Retiring soon") return 4;
  return 2;
}

/** Community-strength dots from communityScore (0–100); null → 1. */
export function communityDots(set: Pick<LegoSet, "communityScore">): 1 | 2 | 3 | 4 | 5 {
  if (set.communityScore == null) return 1;
  return dotsFromBuckets(set.communityScore, [50, 65, 75, 85]);
}

/** Liquidity dots — parses "High · 200+ listings" / "Medium · …" / "Low · …". */
export function liquidityDots(set: Pick<LegoSet, "liquidity">): 1 | 2 | 3 | 4 | 5 {
  const t = set.liquidity.toLowerCase();
  if (t.startsWith("high")) return 5;
  if (t.startsWith("medium")) return 3;
  if (t.startsWith("low")) return 2;
  return 3;
}

/** Price-agreement dots — parses "92%" → number 0–100. */
export function agreementDots(set: Pick<LegoSet, "priceAgreement">): 1 | 2 | 3 | 4 | 5 {
  const n = Number(set.priceAgreement.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return 3;
  return dotsFromBuckets(n, [70, 80, 87, 92]);
}

/** ROI percent for a scenario terminal price. */
export function scenarioRoi(currentPrice: number, terminalPrice: number): number {
  if (currentPrice <= 0) return 0;
  return ((terminalPrice - currentPrice) / currentPrice) * 100;
}

/** eBay deep link with optional EPN campaign ID. */
export function ebayUrl(set: Pick<LegoSet, "name" | "setNumber">): string {
  const q = encodeURIComponent(`LEGO ${set.setNumber} ${set.name} sealed`);
  const base = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sop=15`;
  const campaign = process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID;
  if (!campaign) return base;
  return `https://rover.ebay.com/rover/1/711-53200-19255-0/1?campid=${campaign}&toolid=10001&mpre=${encodeURIComponent(base)}`;
}

/** BrickLink set page deep link. */
export function brickLinkUrl(set: Pick<LegoSet, "setNumber">): string {
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${set.setNumber}-1`;
}

/** BrickLink hosted set image (front-of-box). */
export function brickLinkImageUrl(set: Pick<LegoSet, "setNumber">): string {
  return `https://img.bricklink.com/ItemImage/SN/0/${set.setNumber}-1.png`;
}
