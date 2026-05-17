/**
 * Hold ROI projection for a LEGO set you already own.
 *
 * Compounds the current estimated value forward over `holdMonths` at the
 * supplied annual appreciation rate, then subtracts storage costs and the
 * original acquisition cost to derive net gain.
 */

export interface HoldRoiInput {
  currentValue: number;
  acquisitionCost: number;
  holdMonths: number;
  monthlyStorageCost?: number;
  expectedAnnualAppreciation: number;
}

export interface HoldRoiResult {
  projectedValueAtEnd: number;
  totalStorageCost: number;
  netGain: number;
  netGainPercent: number;
  annualizedReturnPercent: number;
}

export function projectHoldRoi(input: HoldRoiInput): HoldRoiResult {
  const {
    currentValue,
    acquisitionCost,
    holdMonths,
    monthlyStorageCost = 0,
    expectedAnnualAppreciation,
  } = input;

  const months = Math.max(0, holdMonths);
  const years = months / 12;

  const projectedValueAtEnd =
    currentValue * Math.pow(1 + expectedAnnualAppreciation, years);
  const totalStorageCost = monthlyStorageCost * months;
  const netGain = projectedValueAtEnd - acquisitionCost - totalStorageCost;

  const baseForPercent = currentValue > 0 ? currentValue : 1;
  const netGainPercent = netGain / baseForPercent;

  let annualizedReturnPercent = 0;
  if (months > 0 && 1 + netGainPercent > 0) {
    annualizedReturnPercent = Math.pow(1 + netGainPercent, 12 / months) - 1;
  }

  return {
    projectedValueAtEnd,
    totalStorageCost,
    netGain,
    netGainPercent,
    annualizedReturnPercent,
  };
}
