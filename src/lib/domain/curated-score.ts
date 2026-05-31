import type { CompositeScore, ScoreFactors } from '@/lib/types/curated';

const THEME_SCORES: Record<string, number> = {
  'Star Wars': 5,
  'Icons': 5,
  'Ideas': 5,
  'Modular Buildings': 5,
  'Creator Expert': 5,
  'Harry Potter': 4,
  'Marvel': 4,
  'DC': 4,
  'Disney': 4,
  'Botanical': 4,
  'Technic': 3,
  'Architecture': 3,
  'Speed Champions': 3,
  'City': 2,
  'Friends': 2,
  'Ninjago': 2,
  'Minecraft': 2,
};

export function scoreRetirementTiming(
  monthsRemaining: number | null,
  retired: boolean
): number {
  if (retired) return 5;
  if (monthsRemaining === null) return 2;
  if (monthsRemaining <= 3) return 5;
  if (monthsRemaining <= 9) return 4;
  if (monthsRemaining <= 18) return 3;
  if (monthsRemaining <= 36) return 2;
  return 1;
}

export function scoreThemeStrength(theme: string): number {
  return THEME_SCORES[theme] ?? 1;
}

export function scoreBricklinkDemand(soldCount6mo: number | null): number {
  if (soldCount6mo === null) return 2;
  if (soldCount6mo > 200) return 5;
  if (soldCount6mo >= 100) return 4;
  if (soldCount6mo >= 50) return 3;
  if (soldCount6mo >= 20) return 2;
  return 1;
}

export function scorePurchaseDiscount(
  originalMsrp: number,
  currentPrice: number | null
): number {
  if (currentPrice === null) return 2;
  const discount = (originalMsrp - currentPrice) / originalMsrp;
  if (discount >= 0.30) return 5;
  if (discount >= 0.20) return 4;
  if (discount >= 0.10) return 3;
  if (discount >= 0) return 2;
  return 1;
}

export function scoreExclusiveContent(hasExclusiveMinifigs: boolean): number {
  return hasExclusiveMinifigs ? 5 : 2;
}

export function scoreCommunityVotes(
  voteCount: number,
  maxVoteCount: number
): number {
  if (maxVoteCount === 0) return 0;
  return (voteCount / maxVoteCount) * 5;
}

export function scoreBand(total: number): CompositeScore['band'] {
  if (total >= 75) return 'strong-buy';
  if (total >= 55) return 'buy';
  return 'watch';
}

interface ScoreInput {
  retirementMonthsRemaining: number | null;
  retired: boolean;
  theme: string;
  bricklinkSoldCount6mo: number | null;
  currentPrice: number | null;
  originalMsrp: number;
  hasExclusiveMinifigs: boolean;
  voteCount: number;
  maxVoteCount: number;
}

export function computeCompositeScore(input: ScoreInput): CompositeScore {
  const factors: ScoreFactors = {
    retirementTiming: scoreRetirementTiming(
      input.retirementMonthsRemaining,
      input.retired
    ),
    themeStrength: scoreThemeStrength(input.theme),
    bricklinkDemand: scoreBricklinkDemand(input.bricklinkSoldCount6mo),
    purchaseDiscount: scorePurchaseDiscount(
      input.originalMsrp,
      input.currentPrice
    ),
    exclusiveContent: scoreExclusiveContent(input.hasExclusiveMinifigs),
    communityVotes: scoreCommunityVotes(input.voteCount, input.maxVoteCount),
  };

  const weightedSum =
    factors.retirementTiming * 0.30 +
    factors.themeStrength * 0.20 +
    factors.bricklinkDemand * 0.15 +
    factors.purchaseDiscount * 0.15 +
    factors.exclusiveContent * 0.10 +
    factors.communityVotes * 0.10;

  const total = Math.round((weightedSum / 5) * 100);

  return { total, band: scoreBand(total), factors };
}
