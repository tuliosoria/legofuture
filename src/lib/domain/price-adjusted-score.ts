import type { LegoSetSignal } from "@/lib/domain/lego-set";

/**
 * Curated scores and signals in `sets.ts` were set against the curated
 * price. Prices move (daily eBay refresh since November 2026), so the
 * ranking re-weighs the forecast-CAGR part of the composite score against
 * today's price: the methodology gives CAGR 35% of the score, with a
 * 0–30% CAGR band mapped onto 0–100 points.
 *
 * Signals only move down: a set whose projected 5-year growth from today's
 * price falls under 6%/yr is no longer a Buy, and under 2%/yr it is a Hold.
 */
export const CAGR_WEIGHT = 0.35;
export const CAGR_POINTS_PER_PCT = 100 / 30;
export const WATCH_BELOW_CAGR = 0.06;
export const HOLD_BELOW_CAGR = 0.02;

export function impliedCagr(price: number, proj5y: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(proj5y) || price <= 0 || proj5y <= 0) return null;
  return Math.pow(proj5y / price, 1 / 5) - 1;
}

export function adjustForCurrentPrice(
  curated: { score: number; signal: LegoSetSignal; currentPrice: number; proj5y: number },
  live: { currentPrice: number; proj5y: number }
): { score: number; signal: LegoSetSignal } {
  const base = impliedCagr(curated.currentPrice, curated.proj5y);
  const now = impliedCagr(live.currentPrice, live.proj5y);
  if (base === null || now === null) return { score: curated.score, signal: curated.signal };

  const deltaPct = (now - base) * 100;
  const score = Math.max(0, Math.min(100, Math.round(curated.score + CAGR_WEIGHT * CAGR_POINTS_PER_PCT * deltaPct)));

  let signal = curated.signal;
  if (signal === "Sell") return { score, signal };
  if (now < HOLD_BELOW_CAGR) signal = "Hold";
  else if (now < WATCH_BELOW_CAGR && (signal === "Buy" || signal === "Strong Buy")) signal = "Watch";
  return { score, signal };
}
