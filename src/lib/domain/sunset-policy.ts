/** Fail closed until a reviewed provider + model contract is implemented.
 * No environment flag can restore legacy PC or ambiguous sales publication. */
export function isValuationSuspended(): boolean { return true; }
export const VALUATION_UNAVAILABLE = "Forecasts and sold-price rankings are suspended pending a verified sales source. Asking prices are offers, not completed sales.";
