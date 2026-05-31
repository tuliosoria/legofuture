export interface CuratedSet {
  setNumber: string;
  name: string;
  theme: string;
  subtheme?: string;
  originalMsrp: number;
  targetBuyPrice: number;
  retired: boolean;
  retiringSoon: boolean;
  hasExclusiveMinifigs: boolean;
  pieceCount: number;
  imageUrl: string;
  slug: string;
  notes: string;
}

/** Live data stored in DDB, refreshed by sync-external-scores.mjs */
export interface CuratedScores {
  setNumber: string;
  bricklinkSoldCount6mo: number | null;
  retirementMonthsRemaining: number | null;
  currentPrice: number | null;
  voteCount: number;
  lastRefreshed: string;
}

/** Merged set + scores, used by pages and components */
export interface CuratedItem {
  set: CuratedSet;
  scores: CuratedScores;
  compositeScore: CompositeScore;
}

export interface ScoreFactors {
  retirementTiming: number;
  themeStrength: number;
  bricklinkDemand: number;
  purchaseDiscount: number;
  exclusiveContent: number;
  communityVotes: number;
}

export interface CompositeScore {
  total: number;
  band: 'strong-buy' | 'buy' | 'watch';
  factors: ScoreFactors;
}
