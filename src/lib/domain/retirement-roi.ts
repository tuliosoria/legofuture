/**
 * Retirement ROI: project a soon-to-retire (or just-retired) set's value
 * at some horizon under pessimist / moderate / optimist CAGRs.
 */

export type RetirementScenarioName = "pessimist" | "moderate" | "optimist";

export interface RetirementRoiInput {
  retailPrice: number;
  horizonYears: number;
  pessimistCagr: number;
  moderateCagr: number;
  optimistCagr: number;
}

export interface ScenarioProjection {
  scenario: RetirementScenarioName;
  projectedValue: number;
  totalReturnPercent: number;
  annualizedReturnPercent: number;
}

export interface RetirementRoiResult {
  scenarios: ScenarioProjection[];
  bestCase: ScenarioProjection;
  worstCase: ScenarioProjection;
}

function projectScenario(
  scenario: RetirementScenarioName,
  retailPrice: number,
  horizonYears: number,
  cagr: number
): ScenarioProjection {
  const years = Math.max(0, horizonYears);
  const projectedValue = retailPrice * Math.pow(1 + cagr, years);
  const base = retailPrice > 0 ? retailPrice : 1;
  const totalReturnPercent = (projectedValue - retailPrice) / base;
  const annualizedReturnPercent = years > 0 ? cagr : 0;
  return { scenario, projectedValue, totalReturnPercent, annualizedReturnPercent };
}

export function projectRetirementRoi(input: RetirementRoiInput): RetirementRoiResult {
  const { retailPrice, horizonYears, pessimistCagr, moderateCagr, optimistCagr } = input;

  const scenarios: ScenarioProjection[] = [
    projectScenario("pessimist", retailPrice, horizonYears, pessimistCagr),
    projectScenario("moderate", retailPrice, horizonYears, moderateCagr),
    projectScenario("optimist", retailPrice, horizonYears, optimistCagr),
  ];

  const sortedByValue = [...scenarios].sort((a, b) => a.projectedValue - b.projectedValue);
  const worstCase = sortedByValue[0];
  const bestCase = sortedByValue[sortedByValue.length - 1];

  return { scenarios, bestCase, worstCase };
}
