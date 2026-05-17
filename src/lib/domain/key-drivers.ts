import type { LegoSet, Forecast } from "@/lib/types/lego";

export interface KeyDriver {
  label: string;
  impact: "positive" | "neutral" | "negative";
  explanation: string;
}

export function buildKeyDrivers(
  product: LegoSet,
  forecast: Forecast
): KeyDriver[] {
  const ageYears = new Date().getFullYear() - product.releaseYear;
  const drivers: KeyDriver[] = [];

  // Retirement status
  drivers.push({
    label: "Retirement status",
    impact: product.retired ? "positive" : "neutral",
    explanation: product.retired
      ? "Set is retired — fixed supply ceiling historically drives appreciation."
      : "Still in production — supply is not yet constrained.",
  });

  // Age
  {
    let impact: "positive" | "neutral" | "negative" = "neutral";
    let explanation = `${ageYears} years since release — building pricing history.`;
    if (ageYears >= 5) {
      impact = "positive";
      explanation = `${ageYears} years since release — established vintage premium with thinning sealed supply.`;
    } else if (ageYears < 2) {
      impact = "negative";
      explanation = `Only ${ageYears} year${ageYears !== 1 ? "s" : ""} old — too early to see sustained appreciation.`;
    }
    drivers.push({ label: "Age since release", impact, explanation });
  }

  // Current vs MSRP
  if (product.originalMsrp > 0) {
    const ratio = forecast.currentPrice / product.originalMsrp;
    drivers.push({
      label: "Current vs. MSRP",
      impact: ratio > 1.5 ? "positive" : ratio < 0.9 ? "positive" : "neutral",
      explanation:
        ratio > 1.5
          ? `Trading at ${(ratio * 100).toFixed(0)}% of MSRP — meaningful appreciation already.`
          : ratio < 0.9
            ? `Below original MSRP — potential value opportunity.`
            : `Close to original MSRP — appreciation still moderate.`,
    });
  }

  // Piece count proxy for premium tier
  {
    const impact: "positive" | "neutral" = product.pieceCount >= 3000 ? "positive" : "neutral";
    drivers.push({
      label: "Premium tier",
      impact,
      explanation:
        product.pieceCount >= 3000
          ? `Large set (${product.pieceCount.toLocaleString()} pieces) — premium price point often retains collector demand.`
          : `Mid-size set (${product.pieceCount.toLocaleString()} pieces) — broader audience but more competition.`,
    });
  }

  // Annual rate
  {
    const annualPct = (forecast.annualRate * 100).toFixed(1);
    drivers.push({
      label: "Modeled CAGR",
      impact: forecast.annualRate >= 0.08 ? "positive" : forecast.annualRate >= 0.03 ? "neutral" : "negative",
      explanation: `Model projects a ${annualPct}% compound annual growth rate over 5 years.`,
    });
  }

  return drivers;
}
