import type {
  Confidence,
  Forecast,
  HistoryPoint,
  LegoEra,
  LegoSet,
  ProductPricing,
  Recommendation,
  Scenario,
} from "@/lib/types/lego";
import { buildScenarioOutlook } from "./scenarios";
import { deriveConfidence } from "./confidence-display";
import { eraFor } from "@/lib/data/lego-themes";
import {
  getModelConfidence,
  type ModelManifestSummary,
} from "@/lib/ml/lego-forecast-models";

export const SP500_ANNUAL_RETURN = 0.105;

/**
 * Sparse-data guard (spec §11, `lf-ml-sparse-guard`). Sets with fewer
 * historical monthly price points than this threshold are flagged
 * `forecastEligible: false` and the detail page renders an "Insufficient
 * price history" panel instead of a forecast. Raised from 3 → 6 once
 * sparse-history forecasts proved noisy in backtests.
 */
export const MIN_HISTORY_POINTS_FOR_FORECAST = 6;

/* ------------------------------------------------------------------ */
/* New v2 forecast surface — `forecastForSet` + `SetForecast`         */
/*                                                                    */
/* The shape below is the contract consumed by `/api/sets/forecast`,  */
/* the Bloomberg-style detail page, and `/api/sets/top-buys`.         */
/* The legacy `computeForecast` / `Forecast` types are preserved      */
/* below for the catalog list page until that surface is migrated.    */
/* ------------------------------------------------------------------ */

export interface SetForecastScenario {
  cagr: number;
  projectedValue5yr: number;
}

export interface SetForecastBreakdownRow {
  label: string;
  value: string;
  sub?: string;
}

export interface SetForecast {
  setId: string;
  recommendation: Recommendation;
  confidence: Confidence;
  scenarios: {
    pessimist: SetForecastScenario;
    moderate: SetForecastScenario;
    optimist: SetForecastScenario;
  };
  projectionSeries: Array<{
    year: number;
    pessimist: number;
    moderate: number;
    optimist: number;
  }>;
  drivers: string[];
  breakdown: SetForecastBreakdownRow[];
  forecastEligible: boolean;
  ineligibleReason?: string;
  updatedAt: string;
  currentPrice: number | null;
  modelVersion: string | null;
}

interface EraCagrTriple {
  p: number;
  m: number;
  o: number;
}

const ERA_BASE_CAGR: Record<LegoEra, EraCagrTriple> = {
  Classic: { p: 0.02, m: 0.06, o: 0.10 },
  Modern: { p: 0.03, m: 0.08, o: 0.14 },
  Licensed: { p: 0.04, m: 0.10, o: 0.18 },
  Premium: { p: 0.05, m: 0.12, o: 0.22 },
};

const CAGR_CAPS: EraCagrTriple = { p: 0.10, m: 0.20, o: 0.35 };

function pickPrice(pricing: ProductPricing | null): number | null {
  if (!pricing) return null;
  return pricing.newPrice ?? pricing.cibPrice ?? pricing.loosePrice ?? null;
}

function emptyScenarios(): SetForecast["scenarios"] {
  return {
    pessimist: { cagr: 0, projectedValue5yr: 0 },
    moderate: { cagr: 0, projectedValue5yr: 0 },
    optimist: { cagr: 0, projectedValue5yr: 0 },
  };
}

function applyAdjustments(base: EraCagrTriple, set: LegoSet): EraCagrTriple {
  let { p, m, o } = base;
  if (set.retired === true) {
    p *= 1.2; m *= 1.2; o *= 1.2;
  } else if (set.retiringSoon === true) {
    p *= 1.1; m *= 1.1; o *= 1.1;
  }
  if ((set.pieceCount ?? 0) >= 3000) {
    p *= 1.1; m *= 1.1; o *= 1.1;
  }
  return {
    p: Math.min(p, CAGR_CAPS.p),
    m: Math.min(m, CAGR_CAPS.m),
    o: Math.min(o, CAGR_CAPS.o),
  };
}

function recommendFromCagr(annualCagr: number, holdCostAnnual = 0.02): Recommendation {
  const net = annualCagr - holdCostAnnual;
  if (net >= 0.08) return "buy";
  if (net >= 0.02) return "hold";
  return "sell";
}

function deriveSetConfidence(
  history: HistoryPoint[],
  set: LegoSet
): Confidence {
  const monthsCovered = Math.min(history.length, 36);
  const historyScore = Math.min(monthsCovered / 24, 1);
  // Peer info isn't yet wired through here — proxy off retirement+age
  const age = new Date().getFullYear() - (set.releaseYear ?? new Date().getFullYear());
  const peerScore = set.retired && age >= 3 ? 0.7 : set.retired ? 0.45 : 0.3;
  const signalAgreement = set.retired ? 0.7 : 0.5;
  const composite =
    historyScore * 0.5 + peerScore * 0.25 + signalAgreement * 0.25;
  if (composite >= 0.7) return "high";
  if (composite >= 0.4) return "medium";
  return "low";
}

function buildProjectionSeries5yr(
  currentPrice: number,
  cagrP: number,
  cagrM: number,
  cagrO: number,
  years = 5
): SetForecast["projectionSeries"] {
  const out: SetForecast["projectionSeries"] = [];
  for (let year = 0; year <= years; year++) {
    out.push({
      year,
      pessimist: Math.round(currentPrice * Math.pow(1 + cagrP, year)),
      moderate: Math.round(currentPrice * Math.pow(1 + cagrM, year)),
      optimist: Math.round(currentPrice * Math.pow(1 + cagrO, year)),
    });
  }
  return out;
}

function buildBreakdownRows(
  set: LegoSet,
  base: EraCagrTriple,
  adjusted: EraCagrTriple
): SetForecastBreakdownRow[] {
  const rows: SetForecastBreakdownRow[] = [];
  const era: LegoEra = set.era ?? eraFor(set.theme);
  rows.push({
    label: `${era} era base CAGR`,
    value: `${(base.m * 100).toFixed(1)}%`,
    sub: "Moderate-scenario starting point for this era",
  });
  const ageYears = Math.max(0, new Date().getFullYear() - set.releaseYear);
  rows.push({
    label: "Set age",
    value: `${ageYears} year${ageYears === 1 ? "" : "s"}`,
    sub: ageYears >= 5 ? "Established vintage premium" : "Still building price history",
  });
  if (set.retired) {
    rows.push({
      label: "Retirement premium",
      value: "+20% to base CAGR",
      sub: "Fixed supply ceiling lifts long-run appreciation",
    });
  } else if (set.retiringSoon) {
    rows.push({
      label: "Retiring soon",
      value: "+10% to base CAGR",
      sub: "Production wind-down expected within ~12 months",
    });
  }
  if ((set.pieceCount ?? 0) >= 3000) {
    rows.push({
      label: "Premium scale",
      value: `${set.pieceCount.toLocaleString()} pieces`,
      sub: "Large sets often retain stronger collector demand",
    });
  }
  rows.push({
    label: "Moderate CAGR (post-adjustments)",
    value: `${(adjusted.m * 100).toFixed(1)}%`,
    sub: "Used to compute the 5-year moderate projection",
  });
  return rows;
}

function buildDrivers(set: LegoSet, adjusted: EraCagrTriple): string[] {
  const drivers: string[] = [];
  const era: LegoEra = set.era ?? eraFor(set.theme);
  if (set.retired) {
    drivers.push(
      `${set.theme} retired sets carry a retirement premium (+20% CAGR uplift in our model).`
    );
  } else if (set.retiringSoon) {
    drivers.push(
      `${set.theme} flagged as retiring soon — supply tightening typically lifts secondary prices.`
    );
  }
  if ((set.pieceCount ?? 0) >= 3000) {
    drivers.push(
      `Premium scale (${set.pieceCount.toLocaleString()} pieces) — large sets historically retain stronger collector demand.`
    );
  }
  drivers.push(
    `${era}-era moderate CAGR projected at ${(adjusted.m * 100).toFixed(1)}% per year.`
  );
  return drivers.slice(0, 5);
}

/**
 * v2 forecast — deterministic heuristic. Replace internals when a real
 * model lands; keep the signature stable.
 */
export function forecastForSet(
  set: LegoSet,
  pricing: ProductPricing | null,
  history: HistoryPoint[],
  manifest: ModelManifestSummary | null = null
): SetForecast {
  const currentPrice = pickPrice(pricing);
  const updatedAt = new Date().toISOString();
  const modelVersion = manifest?.available ? manifest.version : null;

  if (history.length < MIN_HISTORY_POINTS_FOR_FORECAST) {
    return {
      setId: set.id,
      recommendation: "hold",
      confidence: "low",
      scenarios: emptyScenarios(),
      projectionSeries: [],
      drivers: [],
      breakdown: [],
      forecastEligible: false,
      ineligibleReason: "Insufficient price history (need ≥6 monthly points)",
      updatedAt,
      currentPrice,
      modelVersion,
    };
  }

  const era: LegoEra = set.era ?? eraFor(set.theme);
  const base = ERA_BASE_CAGR[era];
  const adjusted = applyAdjustments(base, set);

  const priceForProjection = currentPrice ?? set.originalMsrp ?? 0;
  const series = buildProjectionSeries5yr(
    priceForProjection,
    adjusted.p,
    adjusted.m,
    adjusted.o,
    5
  );

  const scenarios: SetForecast["scenarios"] = {
    pessimist: {
      cagr: adjusted.p,
      projectedValue5yr: Math.round(priceForProjection * Math.pow(1 + adjusted.p, 5)),
    },
    moderate: {
      cagr: adjusted.m,
      projectedValue5yr: Math.round(priceForProjection * Math.pow(1 + adjusted.m, 5)),
    },
    optimist: {
      cagr: adjusted.o,
      projectedValue5yr: Math.round(priceForProjection * Math.pow(1 + adjusted.o, 5)),
    },
  };

  const heuristicConfidence = deriveSetConfidence(history, set);
  // If a trained model manifest exists, blend its sample-size + R² band
  // with the heuristic confidence: the more conservative of the two wins,
  // so a thin/poor model never inflates confidence above the heuristic.
  let confidence: Confidence = heuristicConfidence;
  const drivers = buildDrivers(set, adjusted);
  const breakdown = buildBreakdownRows(set, base, adjusted);
  if (manifest?.available && manifest.metrics) {
    const modelConfidence = getModelConfidence(manifest.sampleCount, manifest.metrics);
    const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
    confidence = rank[modelConfidence] < rank[heuristicConfidence]
      ? modelConfidence
      : heuristicConfidence;
    const r2 = manifest.metrics.p5yr.r2;
    const rmse = manifest.metrics.p5yr.rmse;
    breakdown.push({
      label: "Model confidence band",
      value: `R²=${r2.toFixed(2)} · RMSE=$${Math.round(rmse).toLocaleString()}`,
      sub: `XGBoost trained on ${manifest.sampleCount.toLocaleString()} samples (${manifest.version})`,
    });
    drivers.push(
      `Model v${manifest.version}: 5yr R²=${r2.toFixed(2)} on ${manifest.sampleCount.toLocaleString()} samples — heuristic CAGR retained, confidence ${confidence}.`
    );
  }

  return {
    setId: set.id,
    recommendation: recommendFromCagr(adjusted.m),
    confidence,
    scenarios,
    projectionSeries: series,
    drivers: drivers.slice(0, 6),
    breakdown,
    forecastEligible: true,
    updatedAt,
    currentPrice,
    modelVersion,
  };
}

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
  product: LegoSet,
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
