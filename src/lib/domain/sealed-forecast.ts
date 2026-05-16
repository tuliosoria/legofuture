import type { Confidence, Forecast, Scenario, SealedProduct, ProductPricing } from "@/lib/types/sealed";
import { buildScenarioOutlook } from "./scenarios";
import { deriveConfidence } from "./confidence-display";

export const SP500_ANNUAL_RETURN = 0.105;

/**
 * Simple deterministic placeholder model.
 * Will be replaced by XGBoost in Phase 9.
 *
 * Base CAGR logic:
 *  - Retired sets: 8% + min(ageYears × 0.5%, 5%)
 *  - Current sets: 3%
 *  - GWP / $0 MSRP sets: 4%
 *
 * Pessimist = 0.5×, Moderate = 1.0×, Optimist = 1.5×
 * Sets < 12 months old: status = "too_new"
 */
export function computeForecast(
  product: SealedProduct,
  pricing: ProductPricing | null
): Forecast {
  const currentPrice = pricing?.newPrice ?? product.originalMsrp;
  const ageYears = new Date().getFullYear() - product.releaseYear;
  const id = product.id;

  // Block very new sets
  if (ageYears < 1) {
    const stub = buildScenarioOutlook(currentPrice, 0.03, "moderate");
    return {
      id,
      currentPrice,
      projectedValue: currentPrice,
      dollarGain: 0,
      roiPercent: 0,
      annualRate: 0,
      signal: "Hold",
      confidence: "low",
      status: "too_new",
      statusMessage: "Set is less than 12 months old — forecasting requires at least one year of pricing history.",
      predictionSpreadPercent: 35,
      scenarios: {
        pessimist: stub,
        moderate: stub,
        optimist: stub,
      },
    };
  }

  // Compute base CAGR
  let baseCagr: number;
  if (product.originalMsrp === 0) {
    // GWP / freebie
    baseCagr = 0.04;
  } else if (product.retired) {
    const ageBoost = Math.min(ageYears * 0.005, 0.05);
    baseCagr = 0.08 + ageBoost;
  } else {
    baseCagr = 0.03;
  }

  // Adjust by current-vs-msrp ratio when MSRP is known
  if (product.originalMsrp > 0 && currentPrice > 0) {
    const ratio = currentPrice / product.originalMsrp;
    if (ratio > 2) {
      // Already appreciated a lot — temper forward expectations
      baseCagr *= 0.75;
    } else if (ratio < 0.9) {
      // Trading below retail — mild upward pressure
      baseCagr += 0.01;
    }
  }

  const salesVolume = pricing?.salesVolume ? Number(pricing.salesVolume) : null;
  const confidence: Confidence = deriveConfidence({
    ageYears,
    salesVolume,
    retired: product.retired,
    msrpRatio: product.originalMsrp > 0 ? currentPrice / product.originalMsrp : null,
  });

  const spread = product.retired ? 20 : 28;

  const scenarios: Record<Scenario, ReturnType<typeof buildScenarioOutlook>> = {
    pessimist: buildScenarioOutlook(currentPrice, baseCagr, "pessimist"),
    moderate: buildScenarioOutlook(currentPrice, baseCagr, "moderate"),
    optimist: buildScenarioOutlook(currentPrice, baseCagr, "optimist"),
  };

  const moderate = scenarios.moderate;

  return {
    id,
    currentPrice,
    projectedValue: moderate.projectedValue,
    dollarGain: moderate.dollarGain,
    roiPercent: moderate.roiPercent,
    annualRate: moderate.annualRate,
    signal: moderate.signal,
    confidence,
    status: "ready",
    statusMessage: null,
    predictionSpreadPercent: spread,
    scenarios,
  };
}

export function getSignalBg(signal: "Buy" | "Hold" | "Sell"): string {
  switch (signal) {
    case "Buy":
      return "bg-emerald-500 border-emerald-300 text-white";
    case "Hold":
      return "bg-amber-500 border-amber-300 text-zinc-900";
    case "Sell":
      return "bg-rose-500 border-rose-300 text-white";
  }
}

export function getSignalColor(signal: "Buy" | "Hold" | "Sell"): string {
  switch (signal) {
    case "Buy":
      return "text-emerald-400";
    case "Hold":
      return "text-amber-400";
    case "Sell":
      return "text-rose-400";
  }
}

export function getConfidenceBg(confidence: Confidence): string {
  switch (confidence) {
    case "high":
      return "bg-blue-500/20 text-blue-400";
    case "medium":
      return "bg-orange-500/20 text-orange-400";
    case "low":
      return "bg-zinc-500/20 text-zinc-400";
  }
}
