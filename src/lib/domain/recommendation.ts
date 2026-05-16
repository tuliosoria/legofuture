import type { Confidence, Recommendation } from "@/lib/types/sealed";

export interface RecommendationInput {
  annualRate: number;
  confidence: Confidence;
  releaseYear: number;
  retired: boolean;
}

/**
 * Derive a user-facing buy / hold / sell label from the forecast.
 *
 * - annualRate >= 10 %        → buy
 * - annualRate >= 5 % AND high/medium confidence → buy
 * - annualRate >= 3 %        → hold
 * - set < 12 months old      → hold (too new to commit)
 * - annualRate < 3 %         → sell
 */
export function deriveRecommendation(
  input: RecommendationInput
): Recommendation {
  const { annualRate, confidence, releaseYear } = input;
  const ageYears = new Date().getFullYear() - releaseYear;

  if (ageYears < 1) return "hold";

  if (annualRate >= 0.10) return "buy";
  if (annualRate >= 0.05 && confidence !== "low") return "buy";
  if (annualRate >= 0.03) return "hold";
  return "sell";
}
