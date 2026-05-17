import type { Confidence } from "@/lib/types/lego";

export interface ConfidenceInput {
  /** Years since release */
  ageYears: number;
  /** PriceCharting sales volume (trailing 30 days) */
  salesVolume: number | null;
  /** Whether set is retired */
  retired: boolean;
  /** Ratio of current price to original MSRP */
  msrpRatio: number | null;
}

/**
 * Derive display confidence from available signals.
 *
 * - retired + age ≥ 5 + volume ≥ 100   → high
 * - retired + age ≥ 3                  → medium
 * - current + volume ≥ 300             → medium
 * - otherwise                          → low
 */
export function deriveConfidence(input: ConfidenceInput): Confidence {
  const { ageYears, salesVolume, retired } = input;
  const vol = salesVolume ?? 0;

  if (retired && ageYears >= 5 && vol >= 100) return "high";
  if (retired && ageYears >= 3) return "medium";
  if (!retired && ageYears >= 2 && vol >= 300) return "medium";
  return "low";
}

export function confidenceLabel(c: Confidence): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}
