/** eBay API License Agreement §8.1(c): item listing display age, not token or quota TTL.
 * https://developer.ebay.com/join/api-license-agreement */
export const EBAY_LISTING_MAX_DISPLAY_AGE_MS = 6 * 60 * 60 * 1000;
export function ebayListingDisplayMaxAge(requestedMaxAgeMs: number): number {
  return Math.min(requestedMaxAgeMs, EBAY_LISTING_MAX_DISPLAY_AGE_MS);
}
export function isEbayListingDisplayable(observedAt: string, now: number, requestedMaxAgeMs = EBAY_LISTING_MAX_DISPLAY_AGE_MS): boolean {
  const observed = Date.parse(observedAt);
  const maxAge = ebayListingDisplayMaxAge(requestedMaxAgeMs);
  return Number.isFinite(observed) && Number.isFinite(now) && Number.isFinite(maxAge) && maxAge > 0 && observed <= now && now - observed <= maxAge;
}
/** Publication permission is evidence supplied by an audited provider adapter, never inferred from cache presence. */
export interface PriceObservation {
  provider: string;
  kind: 'asking' | 'sold' | 'reference';
  productId: string;
  amount: number;
  currency: string;
  condition: string;
  grade?: string;
  gradingCompany?: string;
  observedAt: string;
  fetchedAt: string;
  sampleSize: number;
  periodStart?: string;
  periodEnd?: string;
  matchEvidence: { exact: boolean };
  publicationAllowed: boolean;
}
export interface ObservationPolicy {
  maxAgeMs: number;
  expectedProductId: string;
  expectedCurrency: string;
  expectedCondition: string;
  publicationAllowed: boolean;
}
export type ProviderReason = 'missing-config' | 'auth' | 'quota' | 'timeout' | 'network' | 'no-match' | 'invalid-data' | 'license-unverified';
export type ProviderResult = { status: 'available' | 'stale'; observation: PriceObservation } | { status: 'unavailable'; reason: ProviderReason };
export function evaluateObservation(observation: PriceObservation, policy: ObservationPolicy, now: Date): ProviderResult {
  if (!policy.publicationAllowed || observation.publicationAllowed !== true) return { status:'unavailable', reason:'license-unverified' };
  const observed = Date.parse(observation.observedAt);
  const fetched = Date.parse(observation.fetchedAt);
  if (!Number.isFinite(observation.amount) || observation.amount <= 0 || !Number.isInteger(observation.sampleSize) || observation.sampleSize <= 0 || !Number.isFinite(observed) || !Number.isFinite(fetched) || observed > now.getTime() || fetched > now.getTime() || observed > fetched || !Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs <= 0) return {status:'unavailable',reason:'invalid-data'};
  if (observation.productId !== policy.expectedProductId || observation.currency !== policy.expectedCurrency || observation.condition !== policy.expectedCondition || observation.matchEvidence?.exact !== true) return {status:'unavailable',reason:'no-match'};
  const maxAgeMs = observation.provider === 'ebay' && observation.kind === 'asking'
    ? ebayListingDisplayMaxAge(policy.maxAgeMs)
    : policy.maxAgeMs;
  return {status: now.getTime()-observed > maxAgeMs ? 'stale':'available', observation};
}
export function isForecastAnchor(result: ProviderResult): boolean {
  if (result.status !== 'available') return false;
  const o=result.observation;
  return o.kind === 'sold' && o.publicationAllowed && o.matchEvidence.exact && o.sampleSize > 0 && Number.isFinite(Date.parse(o.periodStart ?? '')) && Number.isFinite(Date.parse(o.periodEnd ?? '')) && Date.parse(o.periodStart!) <= Date.parse(o.periodEnd!) && Date.parse(o.periodEnd!) <= Date.parse(o.observedAt);
}
