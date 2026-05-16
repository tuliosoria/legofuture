import type { Scenario, ScenarioOutlook } from "@/lib/types/sealed";

export const SP500_ANNUAL_RETURN = 0.105;

/** Multipliers applied to the base CAGR per scenario */
export const SCENARIO_MULTIPLIERS: Record<Scenario, number> = {
  pessimist: 0.5,
  moderate: 1.0,
  optimist: 1.5,
};

export const SCENARIO_DESCRIPTIONS: Record<
  Scenario,
  { label: string; short: string; description: string }
> = {
  pessimist: {
    label: "Pessimist",
    short: "Bear case",
    description:
      "Applies a 0.5× multiplier to the base CAGR. Reflects scenarios such as continued retail availability, reduced collector interest, or LEGO price adjustments.",
  },
  moderate: {
    label: "Moderate",
    short: "Base case",
    description:
      "Default model output. Reflects historical appreciation patterns for sets of similar age and retirement status.",
  },
  optimist: {
    label: "Optimist",
    short: "Bull case",
    description:
      "Applies a 1.5× multiplier to the base CAGR. Reflects scenarios such as accelerated retirement, strong secondary demand, or cultural tailwinds.",
  },
};

export function buildScenarioOutlook(
  currentPrice: number,
  baseCagr: number,
  scenario: Scenario,
  years = 5
): ScenarioOutlook {
  const mult = SCENARIO_MULTIPLIERS[scenario];
  const annualRate = baseCagr * mult;
  const projectedValue = Math.round(currentPrice * Math.pow(1 + annualRate, years));
  const dollarGain = projectedValue - currentPrice;
  const roiPercent = currentPrice > 0 ? ((projectedValue - currentPrice) / currentPrice) * 100 : 0;

  let signal: "Buy" | "Hold" | "Sell";
  if (annualRate >= 0.08) signal = "Buy";
  else if (annualRate >= 0.03) signal = "Hold";
  else signal = "Sell";

  return { projectedValue, dollarGain, roiPercent, annualRate, signal };
}
