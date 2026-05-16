import type { SealedProduct, Forecast } from "@/lib/types/sealed";

export interface ForecastBreakdownItem {
  label: string;
  value: string;
  description: string;
  impact: "positive" | "neutral" | "negative";
}

export function buildForecastBreakdown(
  product: SealedProduct,
  forecast: Forecast
): ForecastBreakdownItem[] {
  const ageYears = new Date().getFullYear() - product.releaseYear;
  const items: ForecastBreakdownItem[] = [];

  items.push({
    label: "Theme",
    value: product.theme,
    description: `${product.theme} sets typically command strong collector interest.`,
    impact: "neutral",
  });

  items.push({
    label: "Retirement status",
    value: product.retired ? "Retired" : "Current",
    description: product.retired
      ? "Retired sets have a fixed supply ceiling — a key appreciation driver."
      : "Still available at retail; supply is not yet constrained.",
    impact: product.retired ? "positive" : "neutral",
  });

  items.push({
    label: "Age",
    value: `${ageYears} year${ageYears !== 1 ? "s" : ""}`,
    description:
      ageYears >= 5
        ? "Established vintage premium with thinning sealed supply."
        : ageYears >= 2
          ? "Past initial release volatility."
          : "Relatively new — still building secondary-market pricing history.",
    impact: ageYears >= 5 ? "positive" : ageYears >= 2 ? "neutral" : "negative",
  });

  if (product.originalMsrp > 0) {
    const ratio = forecast.currentPrice / product.originalMsrp;
    items.push({
      label: "Current vs. MSRP",
      value: `${(ratio * 100).toFixed(0)}%`,
      description:
        ratio > 2
          ? `Trading at ${(ratio * 100).toFixed(0)}% of original MSRP — already significantly appreciated.`
          : ratio < 0.9
            ? `Trading below original MSRP — potential value entry point.`
            : `Trading near original MSRP — moderate appreciation so far.`,
      impact: ratio > 2 ? "neutral" : ratio < 0.9 ? "positive" : "neutral",
    });
  }

  items.push({
    label: "Base CAGR (model)",
    value: `${(forecast.annualRate * 100).toFixed(1)}%`,
    description: `Deterministic placeholder model. Production model will use XGBoost trained on historical LEGO market data.`,
    impact: forecast.annualRate >= 0.08 ? "positive" : forecast.annualRate >= 0.03 ? "neutral" : "negative",
  });

  return items;
}
