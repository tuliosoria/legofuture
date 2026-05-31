import { describe, it, expect } from 'vitest';
import {
  scoreRetirementTiming,
  scoreThemeStrength,
  scoreBricklinkDemand,
  scorePurchaseDiscount,
  scoreExclusiveContent,
  scoreCommunityVotes,
  computeCompositeScore,
  scoreBand,
} from './curated-score';

describe('scoreRetirementTiming', () => {
  it('returns 5 for already-retired sets', () => {
    expect(scoreRetirementTiming(null, true)).toBe(5);
  });
  it('returns 5 for retiring in ≤3 months', () => {
    expect(scoreRetirementTiming(2, false)).toBe(5);
  });
  it('returns 4 for retiring in ≤9 months', () => {
    expect(scoreRetirementTiming(6, false)).toBe(4);
  });
  it('returns 3 for retiring in ≤18 months', () => {
    expect(scoreRetirementTiming(12, false)).toBe(3);
  });
  it('returns 2 for retiring in ≤36 months', () => {
    expect(scoreRetirementTiming(24, false)).toBe(2);
  });
  it('returns 1 for more than 36 months out', () => {
    expect(scoreRetirementTiming(48, false)).toBe(1);
  });
  it('returns 2 as default when timing is unknown', () => {
    expect(scoreRetirementTiming(null, false)).toBe(2);
  });
});

describe('scoreThemeStrength', () => {
  it('returns 5 for Star Wars', () => {
    expect(scoreThemeStrength('Star Wars')).toBe(5);
  });
  it('returns 5 for Icons', () => {
    expect(scoreThemeStrength('Icons')).toBe(5);
  });
  it('returns 5 for Ideas', () => {
    expect(scoreThemeStrength('Ideas')).toBe(5);
  });
  it('returns 5 for Modular Buildings', () => {
    expect(scoreThemeStrength('Modular Buildings')).toBe(5);
  });
  it('returns 4 for Harry Potter', () => {
    expect(scoreThemeStrength('Harry Potter')).toBe(4);
  });
  it('returns 4 for Marvel', () => {
    expect(scoreThemeStrength('Marvel')).toBe(4);
  });
  it('returns 3 for Technic', () => {
    expect(scoreThemeStrength('Technic')).toBe(3);
  });
  it('returns 3 for Architecture', () => {
    expect(scoreThemeStrength('Architecture')).toBe(3);
  });
  it('returns 2 for City', () => {
    expect(scoreThemeStrength('City')).toBe(2);
  });
  it('returns 1 for unknown themes', () => {
    expect(scoreThemeStrength('Duplo')).toBe(1);
  });
});

describe('scoreBricklinkDemand', () => {
  it('returns 5 for >200 sold', () => {
    expect(scoreBricklinkDemand(250)).toBe(5);
  });
  it('returns 4 for 100–200 sold', () => {
    expect(scoreBricklinkDemand(150)).toBe(4);
  });
  it('returns 3 for 50–100 sold', () => {
    expect(scoreBricklinkDemand(75)).toBe(3);
  });
  it('returns 2 for 20–50 sold', () => {
    expect(scoreBricklinkDemand(30)).toBe(2);
  });
  it('returns 1 for <20 sold', () => {
    expect(scoreBricklinkDemand(10)).toBe(1);
  });
  it('returns 2 as default when null', () => {
    expect(scoreBricklinkDemand(null)).toBe(2);
  });
});

describe('scorePurchaseDiscount', () => {
  it('returns 5 for ≥30% discount', () => {
    expect(scorePurchaseDiscount(100, 70)).toBe(5);
  });
  it('returns 4 for 20–29% discount', () => {
    expect(scorePurchaseDiscount(100, 77)).toBe(4);
  });
  it('returns 3 for 10–19% discount', () => {
    expect(scorePurchaseDiscount(100, 88)).toBe(3);
  });
  it('returns 2 for 0–9% discount', () => {
    expect(scorePurchaseDiscount(100, 96)).toBe(2);
  });
  it('returns 1 when price is above MSRP', () => {
    expect(scorePurchaseDiscount(100, 110)).toBe(1);
  });
  it('returns 2 as default when currentPrice is null', () => {
    expect(scorePurchaseDiscount(100, null)).toBe(2);
  });
});

describe('scoreExclusiveContent', () => {
  it('returns 5 when set has exclusive minifigs', () => {
    expect(scoreExclusiveContent(true)).toBe(5);
  });
  it('returns 2 for standard sets', () => {
    expect(scoreExclusiveContent(false)).toBe(2);
  });
});

describe('scoreCommunityVotes', () => {
  it('returns 0 when there are no votes in the catalog', () => {
    expect(scoreCommunityVotes(0, 0)).toBe(0);
  });
  it('returns 5 for the set with the most votes', () => {
    expect(scoreCommunityVotes(100, 100)).toBe(5);
  });
  it('returns proportional score for mid-range votes', () => {
    expect(scoreCommunityVotes(50, 100)).toBe(2.5);
  });
});

describe('computeCompositeScore', () => {
  it('computes a weighted total in 0–100 range', () => {
    const result = computeCompositeScore({
      retirementMonthsRemaining: 6,
      retired: false,
      theme: 'Star Wars',
      bricklinkSoldCount6mo: 150,
      currentPrice: 172,
      originalMsrp: 229.99,
      hasExclusiveMinifigs: true,
      voteCount: 50,
      maxVoteCount: 100,
    });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(['strong-buy', 'buy', 'watch']).toContain(result.band);
  });

  it('gives a high score to a near-retirement Star Wars set with exclusive figs at discount', () => {
    const result = computeCompositeScore({
      retirementMonthsRemaining: 2,
      retired: false,
      theme: 'Star Wars',
      bricklinkSoldCount6mo: 250,
      currentPrice: 160,
      originalMsrp: 229.99,
      hasExclusiveMinifigs: true,
      voteCount: 0,
      maxVoteCount: 0,
    });
    expect(result.total).toBeGreaterThanOrEqual(75);
    expect(result.band).toBe('strong-buy');
  });

  it('gives a low score to a generic set above MSRP with no demand', () => {
    const result = computeCompositeScore({
      retirementMonthsRemaining: 48,
      retired: false,
      theme: 'Duplo',
      bricklinkSoldCount6mo: 5,
      currentPrice: 120,
      originalMsrp: 100,
      hasExclusiveMinifigs: false,
      voteCount: 0,
      maxVoteCount: 0,
    });
    expect(result.total).toBeLessThan(55);
    expect(result.band).toBe('watch');
  });
});

describe('scoreBand', () => {
  it('strong-buy for ≥75', () => expect(scoreBand(75)).toBe('strong-buy'));
  it('buy for 55–74', () => expect(scoreBand(65)).toBe('buy'));
  it('watch for <55', () => expect(scoreBand(40)).toBe('watch'));
});
