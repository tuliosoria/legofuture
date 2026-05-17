/**
 * Default CAGR assumptions by "era" used to seed forecast scenarios.
 * Coarse, opinionated starting points.
 */

import type { LegoEra } from "@/lib/types/lego";

export interface CagrTriple {
  pessimist: number;
  moderate: number;
  optimist: number;
}

export const DEFAULT_CAGR_BY_ERA: Record<LegoEra, CagrTriple> = {
  Classic: { pessimist: 0.02, moderate: 0.06, optimist: 0.1 },
  Modern: { pessimist: 0.03, moderate: 0.08, optimist: 0.14 },
  Licensed: { pessimist: 0.04, moderate: 0.1, optimist: 0.18 },
  Premium: { pessimist: 0.05, moderate: 0.12, optimist: 0.22 },
};

export function defaultCagrFor(era: LegoEra): CagrTriple {
  return DEFAULT_CAGR_BY_ERA[era];
}
