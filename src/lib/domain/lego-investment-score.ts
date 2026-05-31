import type {
  Confidence,
  InvestmentUniverse,
  LiquidityTier,
  ProductType,
  ScreenerSignal,
} from "@/lib/types/lego";
import { calculateBrickLinkFees } from "./fees";

export function computeLiquidityScore(
  salesVolume: number | null
): LiquidityTier {
  if (!salesVolume || salesVolume <= 0) return "Insufficient";
  if (salesVolume >= 20) return "High";
  if (salesVolume >= 5) return "Medium";
  return "Low";
}

function shippingCost(pieceCount: number): number {
  if (pieceCount < 300) return 8;
  if (pieceCount < 1000) return 15;
  if (pieceCount < 2500) return 25;
  return 40;
}

export function computeEstimatedNetGain(
  projectedValue: number,
  currentPrice: number,
  pieceCount: number
): number {
  const fees = calculateBrickLinkFees({ salePrice: projectedValue, shippingCost: 0 });
  const packaging = 3;
  const damageReserve = projectedValue * 0.03;
  const shipping = shippingCost(pieceCount);
  return (
    projectedValue -
    currentPrice -
    fees.bricklinkFee -
    fees.paymentProcessorFee -
    packaging -
    damageReserve -
    shipping
  );
}

export function detectOutlier(
  currentPrice: number,
  originalMsrp: number,
  salesVolume: number | null
): boolean {
  if (originalMsrp <= 0) return false;
  const ratio = currentPrice / originalMsrp;
  if (ratio > 20 && (salesVolume == null || salesVolume < 5)) return true;
  return false;
}

export interface InvestmentScoreInput {
  annualRate: number;
  dollarGain: number;
  confidence: Confidence;
  liquidityScore: LiquidityTier;
  retiringSoon: boolean;
  retired: boolean;
  retirementYear: number | null | undefined;
  originalMsrp: number;
  currentPrice: number;
}

export function computeInvestmentScore(input: InvestmentScoreInput): number {
  const currentYear = new Date().getFullYear();
  const {
    annualRate,
    dollarGain,
    confidence,
    liquidityScore,
    retiringSoon,
    retirementYear,
    originalMsrp,
    currentPrice,
  } = input;

  // Retirement proximity (20 pts)
  let retirementPts = 0;
  if (retiringSoon) {
    retirementPts = 20;
  } else if (retirementYear != null) {
    const yearsAway = retirementYear - currentYear;
    if (yearsAway <= 1) retirementPts = 18;
    else if (yearsAway <= 2) retirementPts = 14;
    else if (yearsAway <= 3) retirementPts = 9;
    else retirementPts = 4;
  }

  // Annual rate (25 pts): 15%+ CAGR = full score
  const annualRatePts = Math.min(Math.max(annualRate, 0) / 0.15, 1) * 25;

  // Dollar gain (20 pts): $200+ = full score
  const dollarGainPts = Math.min(Math.max(dollarGain, 0) / 200, 1) * 20;

  // Confidence (15 pts)
  const confidencePts =
    confidence === "high" ? 15 : confidence === "medium" ? 9 : 3;

  // Liquidity (15 pts)
  const liquidityPts =
    liquidityScore === "High"
      ? 15
      : liquidityScore === "Medium"
        ? 9
        : liquidityScore === "Low"
          ? 4
          : 0;

  // Discount to MSRP bonus (5 pts)
  const discountPts =
    originalMsrp > 0 && currentPrice < originalMsrp ? 5 : 0;

  const raw =
    retirementPts +
    annualRatePts +
    dollarGainPts +
    confidencePts +
    liquidityPts +
    discountPts;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

export function assignInvestmentUniverse(
  productType: ProductType,
  retired: boolean,
  outlierFlag: boolean,
  hasPricing: boolean
): InvestmentUniverse {
  if (outlierFlag) return "DataIssue";
  if (!hasPricing) return "DataIssue";
  if (productType !== "Boxed Set") return "CollectorCatalog";
  if (retired) return "RetiredTracker";
  return "InvestableSet";
}

export function deriveScreenerSignal(
  investmentScore: number,
  liquidityScore: LiquidityTier,
  estimatedNetGain: number,
  outlierFlag: boolean,
  investmentUniverse: InvestmentUniverse
): ScreenerSignal {
  if (investmentUniverse === "DataIssue") return "DataIssue";
  if (outlierFlag) return "Avoid";
  if (
    investmentScore >= 80 &&
    (liquidityScore === "High" || liquidityScore === "Medium") &&
    estimatedNetGain >= 40
  )
    return "Strong Buy";
  if (
    investmentScore >= 70 &&
    liquidityScore !== "Insufficient" &&
    estimatedNetGain >= 25
  )
    return "Buy";
  if (investmentScore >= 50) return "Watch";
  return "Avoid";
}

export interface SignalExplainerInput {
  screenerSignal: ScreenerSignal;
  retiringSoon: boolean;
  retired: boolean;
  theme: string;
  liquidityScore: LiquidityTier;
  salesVolume: number | null;
  currentPrice: number;
  originalMsrp: number;
  estimatedNetGain: number;
  annualRate: number;
}

export function buildSignalExplainer(input: SignalExplainerInput): string[] {
  if (input.screenerSignal === "Avoid" || input.screenerSignal === "DataIssue")
    return [];
  const lines: string[] = [];
  if (input.retiringSoon) {
    lines.push("Retiring soon — supply will tighten");
  } else if (input.retired) {
    lines.push("Retired — fixed supply supports appreciation");
  }
  if (
    input.currentPrice > 0 &&
    input.originalMsrp > 0 &&
    input.currentPrice < input.originalMsrp
  ) {
    const pct = Math.round(
      (1 - input.currentPrice / input.originalMsrp) * 100
    );
    lines.push(`${pct}% below MSRP — buying at a discount`);
  }
  if (input.estimatedNetGain > 0) {
    lines.push(`Est. net gain after fees: $${Math.round(input.estimatedNetGain)}`);
  }
  if (input.salesVolume != null && input.salesVolume >= 5) {
    lines.push(
      `${input.liquidityScore} liquidity — ${input.salesVolume} recent listings`
    );
  }
  if (input.annualRate >= 0.08) {
    lines.push(
      `${(input.annualRate * 100).toFixed(0)}% projected annual return`
    );
  }
  return lines.slice(0, 4);
}
