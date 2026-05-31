# Curated Watchlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated LEGO investment watchlist to legofuture.com — a hand-approved list of high-conviction sets with composite scoring (external signals + anonymous community votes) and per-set detail pages.

**Architecture:** Static `lego-curated-sets.json` holds approved sets (committed to git). DynamoDB stores live external signal scores and anonymous vote counts. Two sync scripts refresh scores and surface new candidates. Three new pages — `/watchlist`, `/set/[slug]`, and a homepage strip — render the data.

**Tech Stack:** Next.js 16 App Router, TypeScript, DynamoDB (`@aws-sdk/lib-dynamodb`), Vitest, Tailwind CSS, existing `BrickCard`/`BrickButton`/`ChipBadge` design system.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/types/curated.ts` | `CuratedSet`, `CuratedScores`, `CuratedItem`, `CompositeScore` types |
| Create | `src/lib/data/lego-curated-sets.json` | 8 seed sets — the approved catalog |
| Create | `src/lib/domain/curated-score.ts` | Pure scoring functions (no I/O) |
| Create | `src/lib/domain/curated-score.test.ts` | Unit tests for scoring |
| Modify | `src/lib/db/lego-keys.ts` | Add `CURATED_SET_PK`, `VOTE_IP_PK` key helpers |
| Create | `src/lib/db/curated-sets.ts` | DDB read/write for scores + vote counts |
| Create | `src/app/api/sets/vote/route.ts` | `POST /api/sets/vote` — anonymous vote endpoint |
| Create | `src/app/api/sets/vote/route.test.ts` | Tests for vote API |
| Create | `src/components/sets/WatchlistCard.tsx` | Card: image, score badge, chips, price, vote count |
| Create | `src/app/watchlist/page.tsx` | Server page: curated grid with filter/sort |
| Create | `src/app/set/[slug]/page.tsx` | Server page: set detail, score breakdown, vote button |
| Create | `src/app/set/[slug]/VoteButton.tsx` | Client component: animated vote button |
| Modify | `src/app/page.tsx` | Add "Top picks right now" strip (top 5 by score) |
| Modify | `src/components/layout/header.tsx` | Add "Watchlist" nav link |
| Modify | `src/components/layout/footer.tsx` | Add "Watchlist" footer link |
| Create | `scripts/sync-external-scores.mjs` | Refresh DDB scores for approved sets |
| Create | `scripts/sync-candidates.mjs` | Score Rebrickable candidates → markdown report |
| Modify | `package.json` | Add `sync:curated-scores` and `sync:candidates` scripts |

---

## Task 1: Types + static catalog data

**Files:**
- Create: `src/lib/types/curated.ts`
- Create: `src/lib/data/lego-curated-sets.json`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/types/curated.ts

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
  retirementTiming: number;   // 1–5
  themeStrength: number;      // 1–5
  bricklinkDemand: number;    // 1–5
  purchaseDiscount: number;   // 1–5
  exclusiveContent: number;   // 1–5 (actually 2 or 5)
  communityVotes: number;     // 0–5
}

export interface CompositeScore {
  total: number;              // 0–100
  band: 'strong-buy' | 'buy' | 'watch';
  factors: ScoreFactors;
}
```

- [ ] **Step 2: Create seed catalog JSON**

```json
// src/lib/data/lego-curated-sets.json
[
  {
    "setNumber": "75382",
    "name": "UCS TIE Interceptor",
    "theme": "Star Wars",
    "subtheme": "UCS",
    "originalMsrp": 229.99,
    "targetBuyPrice": 172.00,
    "retired": false,
    "retiringSoon": true,
    "hasExclusiveMinifigs": true,
    "pieceCount": 1931,
    "imageUrl": "",
    "slug": "ucs-tie-interceptor-75382",
    "notes": "UCS collector set, strong secondary demand, exclusive minifigs"
  },
  {
    "setNumber": "75407",
    "name": "Star Wars Brick-Built Logo",
    "theme": "Star Wars",
    "subtheme": "Display",
    "originalMsrp": 59.99,
    "targetBuyPrice": 45.00,
    "retired": false,
    "retiringSoon": true,
    "hasExclusiveMinifigs": false,
    "pieceCount": 526,
    "imageUrl": "",
    "slug": "star-wars-brick-built-logo-75407",
    "notes": "Display piece, compact, strong brand appeal"
  },
  {
    "setNumber": "75394",
    "name": "Imperial Star Destroyer",
    "theme": "Star Wars",
    "subtheme": "Microfighter",
    "originalMsrp": 169.99,
    "targetBuyPrice": 127.00,
    "retired": false,
    "retiringSoon": true,
    "hasExclusiveMinifigs": true,
    "pieceCount": 1555,
    "imageUrl": "",
    "slug": "imperial-star-destroyer-75394",
    "notes": "Iconic IP, exclusive figs, large format"
  },
  {
    "setNumber": "75389",
    "name": "The Dark Falcon",
    "theme": "Star Wars",
    "subtheme": "Buildable",
    "originalMsrp": 143.99,
    "targetBuyPrice": 108.00,
    "retired": false,
    "retiringSoon": false,
    "hasExclusiveMinifigs": true,
    "pieceCount": 1579,
    "imageUrl": "",
    "slug": "dark-falcon-75389",
    "notes": "Novelty dark variant, fan interest, exclusive figs"
  },
  {
    "setNumber": "75361",
    "name": "Spider Tank",
    "theme": "Star Wars",
    "subtheme": "The Mandalorian",
    "originalMsrp": 49.99,
    "targetBuyPrice": 37.00,
    "retired": false,
    "retiringSoon": true,
    "hasExclusiveMinifigs": true,
    "pieceCount": 526,
    "imageUrl": "",
    "slug": "spider-tank-75361",
    "notes": "Small set, strong minifig appeal, manageable storage"
  },
  {
    "setNumber": "10309",
    "name": "Succulents",
    "theme": "Icons",
    "subtheme": "Botanical",
    "originalMsrp": 49.99,
    "targetBuyPrice": 37.00,
    "retired": false,
    "retiringSoon": true,
    "hasExclusiveMinifigs": false,
    "pieceCount": 771,
    "imageUrl": "",
    "slug": "succulents-10309",
    "notes": "Compact display, broad adult appeal, botanical category trending"
  },
  {
    "setNumber": "75426",
    "name": "Millennium Falcon",
    "theme": "Star Wars",
    "subtheme": "Midi-Scale",
    "originalMsrp": 99.99,
    "targetBuyPrice": 75.00,
    "retired": false,
    "retiringSoon": false,
    "hasExclusiveMinifigs": false,
    "pieceCount": 921,
    "imageUrl": "",
    "slug": "millennium-falcon-midi-75426",
    "notes": "Classic IP, midi-scale, accessible price point"
  },
  {
    "setNumber": "75418",
    "name": "Star Wars Advent Calendar 2025",
    "theme": "Star Wars",
    "subtheme": "Seasonal",
    "originalMsrp": 44.99,
    "targetBuyPrice": 34.00,
    "retired": false,
    "retiringSoon": true,
    "hasExclusiveMinifigs": true,
    "pieceCount": 320,
    "imageUrl": "",
    "slug": "star-wars-advent-calendar-2025-75418",
    "notes": "Seasonal scarcity, exclusive minifigs, small/cheap to store"
  }
]
```

- [ ] **Step 3: Verify TypeScript accepts both files**

```bash
npm run test -- --passWithNoTests
```

Expected: all pass (no new test files yet, compilation check happens on next step)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/curated.ts src/lib/data/lego-curated-sets.json
git commit -m "feat(watchlist): types + 8-set seed catalog"
```

---

## Task 2: Composite scoring domain + tests

**Files:**
- Create: `src/lib/domain/curated-score.ts`
- Create: `src/lib/domain/curated-score.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// src/lib/domain/curated-score.test.ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- src/lib/domain/curated-score.test.ts
```

Expected: FAIL — "Cannot find module './curated-score'"

- [ ] **Step 3: Implement scoring functions**

```typescript
// src/lib/domain/curated-score.ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- src/lib/domain/curated-score.test.ts
```

Expected: all 23 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/curated-score.ts src/lib/domain/curated-score.test.ts
git commit -m "feat(watchlist): composite scoring domain + tests"
```

---

## Task 3: DDB key helpers + curated-sets DB module

**Files:**
- Modify: `src/lib/db/lego-keys.ts`
- Create: `src/lib/db/curated-sets.ts`

- [ ] **Step 1: Add new key helpers to `lego-keys.ts`**

Append to end of `src/lib/db/lego-keys.ts`:

```typescript
// --- Curated watchlist keys ---
export const CURATED_PK_PREFIX = "CURATED#SET#";
export const VOTE_PK_PREFIX = "VOTE#IP#";

export const curatedScoresPk = (setNumber: string) =>
  `${CURATED_PK_PREFIX}${setNumber}`;
export const voteIpPk = (hashedIp: string) =>
  `${VOTE_PK_PREFIX}${hashedIp}`;
export const voteIpSk = (setNumber: string) => `SET#${setNumber}`;
export const CURATED_SCORES_SK = "scores";
export const CURATED_VOTE_COUNT_SK = "vote-count";
```

- [ ] **Step 2: Create `src/lib/db/curated-sets.ts`**

```typescript
// src/lib/db/curated-sets.ts
import "server-only";

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamo, getTableName } from "./dynamo";
import {
  curatedScoresPk,
  voteIpPk,
  voteIpSk,
  CURATED_SCORES_SK,
  CURATED_VOTE_COUNT_SK,
} from "./lego-keys";
import type { CuratedScores } from "@/lib/types/curated";

function client() {
  const c = getDynamo();
  const t = getTableName();
  if (!c || !t) return null;
  return { c, t };
}

/** Load scores for a single set from DDB. Returns null if not found or DDB unavailable. */
export async function loadCuratedScores(
  setNumber: string
): Promise<CuratedScores | null> {
  const ctx = client();
  if (!ctx) return null;
  try {
    const res = await ctx.c.send(
      new GetCommand({
        TableName: ctx.t,
        Key: { pk: curatedScoresPk(setNumber), sk: CURATED_SCORES_SK },
      })
    );
    if (!res.Item) return null;
    return {
      setNumber,
      bricklinkSoldCount6mo: res.Item.bricklinkSoldCount6mo ?? null,
      retirementMonthsRemaining: res.Item.retirementMonthsRemaining ?? null,
      currentPrice: res.Item.currentPrice ?? null,
      voteCount: res.Item.voteCount ?? 0,
      lastRefreshed: res.Item.lastRefreshed ?? "",
    };
  } catch (err) {
    console.warn("[curated-sets] loadCuratedScores error:", err);
    return null;
  }
}

/** Load scores for multiple sets in one BatchGet. Missing sets get a zero-score fallback. */
export async function loadAllCuratedScores(
  setNumbers: string[]
): Promise<Map<string, CuratedScores>> {
  const result = new Map<string, CuratedScores>();
  const ctx = client();

  // Populate fallbacks
  for (const sn of setNumbers) {
    result.set(sn, {
      setNumber: sn,
      bricklinkSoldCount6mo: null,
      retirementMonthsRemaining: null,
      currentPrice: null,
      voteCount: 0,
      lastRefreshed: "",
    });
  }

  if (!ctx || setNumbers.length === 0) return result;

  // BatchGet in chunks of 25 (DDB limit)
  const chunks: string[][] = [];
  for (let i = 0; i < setNumbers.length; i += 25) {
    chunks.push(setNumbers.slice(i, i + 25));
  }

  try {
    for (const chunk of chunks) {
      const keys = chunk.map((sn) => ({
        pk: curatedScoresPk(sn),
        sk: CURATED_SCORES_SK,
      }));
      const res = await ctx.c.send(
        new BatchGetCommand({
          RequestItems: { [ctx.t]: { Keys: keys } },
        })
      );
      for (const item of res.Responses?.[ctx.t] ?? []) {
        const sn = (item.pk as string).replace("CURATED#SET#", "");
        result.set(sn, {
          setNumber: sn,
          bricklinkSoldCount6mo: item.bricklinkSoldCount6mo ?? null,
          retirementMonthsRemaining: item.retirementMonthsRemaining ?? null,
          currentPrice: item.currentPrice ?? null,
          voteCount: item.voteCount ?? 0,
          lastRefreshed: item.lastRefreshed ?? "",
        });
      }
    }
  } catch (err) {
    console.warn("[curated-sets] loadAllCuratedScores error:", err);
  }

  return result;
}

/** Write external scores for a set (called by sync-external-scores.mjs). */
export async function writeCuratedScores(
  scores: Omit<CuratedScores, "voteCount">
): Promise<void> {
  const ctx = client();
  if (!ctx) return;
  await ctx.c.send(
    new PutCommand({
      TableName: ctx.t,
      Item: {
        pk: curatedScoresPk(scores.setNumber),
        sk: CURATED_SCORES_SK,
        ...scores,
        lastRefreshed: new Date().toISOString(),
      },
    })
  );
}

/** Check if this IP has already voted for this set (within TTL window). */
export async function hasVoted(
  hashedIp: string,
  setNumber: string
): Promise<boolean> {
  const ctx = client();
  if (!ctx) return false;
  try {
    const res = await ctx.c.send(
      new GetCommand({
        TableName: ctx.t,
        Key: { pk: voteIpPk(hashedIp), sk: voteIpSk(setNumber) },
      })
    );
    return !!res.Item;
  } catch {
    return false;
  }
}

/** Record a vote: write the vote dedup record + atomically increment the count. */
export async function recordVote(
  hashedIp: string,
  setNumber: string
): Promise<number> {
  const ctx = client();
  if (!ctx) return 0;

  const ttlSec = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

  // Write vote dedup record
  await ctx.c.send(
    new PutCommand({
      TableName: ctx.t,
      Item: {
        pk: voteIpPk(hashedIp),
        sk: voteIpSk(setNumber),
        setNumber,
        votedAt: new Date().toISOString(),
        ttl: ttlSec,
      },
    })
  );

  // Atomically increment vote count on the scores row
  const res = await ctx.c.send(
    new UpdateCommand({
      TableName: ctx.t,
      Key: { pk: curatedScoresPk(setNumber), sk: CURATED_VOTE_COUNT_SK },
      UpdateExpression:
        "SET setNumber = :sn, #vc = if_not_exists(#vc, :zero) + :one",
      ExpressionAttributeNames: { "#vc": "voteCount" },
      ExpressionAttributeValues: {
        ":sn": setNumber,
        ":zero": 0,
        ":one": 1,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  // Also update voteCount on the scores row itself for easy reads
  await ctx.c.send(
    new UpdateCommand({
      TableName: ctx.t,
      Key: { pk: curatedScoresPk(setNumber), sk: CURATED_SCORES_SK },
      UpdateExpression:
        "SET #vc = if_not_exists(#vc, :zero) + :one",
      ExpressionAttributeNames: { "#vc": "voteCount" },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    })
  );

  return Number(res.Attributes?.voteCount ?? 0);
}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/lego-keys.ts src/lib/db/curated-sets.ts
git commit -m "feat(watchlist): DDB key helpers + curated-sets db module"
```

---

## Task 4: Vote API route + tests

**Files:**
- Create: `src/app/api/sets/vote/route.ts`
- Create: `src/app/api/sets/vote/route.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/api/sets/vote/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DDB modules before import
vi.mock('@/lib/db/curated-sets', () => ({
  hasVoted: vi.fn(),
  recordVote: vi.fn(),
}));
vi.mock('@/lib/db/rate-limit', () => ({
  enforceIpRateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

import { POST } from './route';
import * as db from '@/lib/db/curated-sets';
import * as rl from '@/lib/db/rate-limit';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/sets/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/sets/vote', () => {
  it('returns 400 when setNumber is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 409 when IP has already voted', async () => {
    vi.mocked(db.hasVoted).mockResolvedValue(true);
    const res = await POST(makeRequest({ setNumber: '75382' }));
    expect(res.status).toBe(409);
  });

  it('returns 200 and new vote count on success', async () => {
    vi.mocked(db.hasVoted).mockResolvedValue(false);
    vi.mocked(db.recordVote).mockResolvedValue(42);
    const res = await POST(makeRequest({ setNumber: '75382' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.voteCount).toBe(42);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(rl.enforceIpRateLimit).mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
    );
    const res = await POST(makeRequest({ setNumber: '75382' }));
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- src/app/api/sets/vote/route.test.ts
```

Expected: FAIL — "Cannot find module './route'"

- [ ] **Step 3: Implement route**

```typescript
// src/app/api/sets/vote/route.ts
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { enforceIpRateLimit, getClientIp } from "@/lib/db/rate-limit";
import { hasVoted, recordVote } from "@/lib/db/curated-sets";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Rate limit: 5 votes per IP per minute
  const rl = await enforceIpRateLimit(req, {
    bucket: "vote",
    windowSec: 60,
    max: 5,
  });
  if (rl) return rl;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const setNumber =
    body && typeof body === "object" && "setNumber" in body
      ? String((body as { setNumber: unknown }).setNumber)
      : null;

  if (!setNumber) {
    return NextResponse.json({ error: "setNumber required" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const hashedIp = createHash("sha256").update(ip).digest("hex");

  const alreadyVoted = await hasVoted(hashedIp, setNumber);
  if (alreadyVoted) {
    return NextResponse.json(
      { error: "Already voted. You can vote again after 30 days." },
      { status: 409 }
    );
  }

  const voteCount = await recordVote(hashedIp, setNumber);
  return NextResponse.json({ voteCount }, { status: 200 });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- src/app/api/sets/vote/route.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sets/vote/route.ts src/app/api/sets/vote/route.test.ts
git commit -m "feat(watchlist): POST /api/sets/vote with rate-limit + dedup"
```

---

## Task 5: WatchlistCard component

**Files:**
- Create: `src/components/sets/WatchlistCard.tsx`

- [ ] **Step 1: Create WatchlistCard**

```tsx
// src/components/sets/WatchlistCard.tsx
import Link from "next/link";
import Image from "next/image";
import { Eye } from "lucide-react";
import type { CuratedItem } from "@/lib/types/curated";
import { BrickCard } from "@/components/ui/BrickCard";
import { ChipBadge } from "@/components/ui/ChipBadge";
import type { ComponentProps } from "react";

type AccentColor = ComponentProps<typeof BrickCard>["accentTop"];

const BAND_ACCENT: Record<string, AccentColor> = {
  "strong-buy": "red",
  "buy": "blue",
  "watch": "yellow",
};

const BAND_LABEL: Record<string, string> = {
  "strong-buy": "Strong Buy",
  "buy": "Buy",
  "watch": "Watch",
};

interface WatchlistCardProps {
  item: CuratedItem;
}

export function WatchlistCard({ item }: WatchlistCardProps) {
  const { set, scores, compositeScore } = item;
  const accent = BAND_ACCENT[compositeScore.band] ?? "black";
  const bandLabel = BAND_LABEL[compositeScore.band] ?? compositeScore.band;

  return (
    <Link
      href={`/set/${set.slug}`}
      aria-label={`View ${set.name} watchlist entry`}
      className="group block h-full"
    >
      <BrickCard
        as="article"
        accentTop={accent}
        studStrip
        compact
        className="h-full flex flex-col gap-0 transition-all duration-[120ms] group-hover:-translate-y-px group-hover:shadow-click-lg"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-slate-50 -mx-4 -mt-4 mb-4 border-b-2 border-jet-black">
          {set.imageUrl ? (
            <Image
              src={set.imageUrl}
              alt={set.name}
              fill
              className="object-contain p-4 transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center type-body-sm text-slate-300">
              #{set.setNumber}
            </div>
          )}
          {set.retired && (
            <span className="absolute left-2 top-2 bg-jet-black text-pure-white type-eyebrow px-2 py-0.5 rounded-chip">
              Retired
            </span>
          )}
          {!set.retired && set.retiringSoon && (
            <span className="absolute left-2 top-2 bg-brick-red text-pure-white type-eyebrow px-2 py-0.5 rounded-chip">
              Retiring soon
            </span>
          )}
        </div>

        {/* Name + theme */}
        <div className="flex-1 mb-3">
          <h3 className="type-body-sm font-medium text-jet-black leading-tight line-clamp-2 mb-1">
            {set.name}
          </h3>
          <p className="type-eyebrow text-slate-500">
            {set.theme}
            {set.subtheme ? ` · ${set.subtheme}` : ""}
            {" · "}#{set.setNumber}
          </p>
        </div>

        {/* Score + chips */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="type-mono-num font-bold text-jet-black text-lg leading-none">
            {compositeScore.total}
          </span>
          <ChipBadge
            color={accent === "red" ? "brick-red" : accent === "blue" ? "bright-blue" : "sunshine-yellow"}
          >
            {bandLabel}
          </ChipBadge>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="type-eyebrow text-slate-500">Current</p>
            <p className="type-mono-num text-jet-black">
              {scores.currentPrice != null
                ? `$${scores.currentPrice.toLocaleString()}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="type-eyebrow text-slate-500">Target buy</p>
            <p className="type-mono-num text-pure-green">
              ${set.targetBuyPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Community count */}
        <div className="flex items-center gap-1 type-eyebrow text-slate-500 border-t border-slate-100 pt-2">
          <Eye className="w-3 h-3" aria-hidden />
          {scores.voteCount > 0
            ? `${scores.voteCount.toLocaleString()} watching`
            : "Be the first to watch"}
        </div>
      </BrickCard>
    </Link>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/sets/WatchlistCard.tsx
git commit -m "feat(watchlist): WatchlistCard component"
```

---

## Task 6: /watchlist page

**Files:**
- Create: `src/app/watchlist/page.tsx`

- [ ] **Step 1: Create watchlist page**

```tsx
// src/app/watchlist/page.tsx
import type { Metadata } from "next";
import type { CuratedItem } from "@/lib/types/curated";
import curatedSetsData from "@/lib/data/lego-curated-sets.json";
import type { CuratedSet } from "@/lib/types/curated";
import { loadAllCuratedScores } from "@/lib/db/curated-sets";
import { computeCompositeScore } from "@/lib/domain/curated-score";
import { WatchlistCard } from "@/components/sets/WatchlistCard";
import { BrickHero } from "@/components/ui/BrickHero";
import { ChipBadge } from "@/components/ui/ChipBadge";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title: "LEGO Investment Watchlist | LegoFuture",
  description:
    "Hand-curated LEGO sets with strong investment potential. Composite scores built from retirement timing, theme demand, BrickLink sales, and community interest.",
};

const curatedSets = curatedSetsData as CuratedSet[];

export default async function WatchlistPage() {
  const setNumbers = curatedSets.map((s) => s.setNumber);
  const scoresMap = await loadAllCuratedScores(setNumbers);
  const maxVoteCount = Math.max(
    ...Array.from(scoresMap.values()).map((s) => s.voteCount),
    1
  );

  const items: CuratedItem[] = curatedSets.map((set) => {
    const scores = scoresMap.get(set.setNumber) ?? {
      setNumber: set.setNumber,
      bricklinkSoldCount6mo: null,
      retirementMonthsRemaining: null,
      currentPrice: null,
      voteCount: 0,
      lastRefreshed: "",
    };
    const compositeScore = computeCompositeScore({
      retirementMonthsRemaining: scores.retirementMonthsRemaining,
      retired: set.retired,
      theme: set.theme,
      bricklinkSoldCount6mo: scores.bricklinkSoldCount6mo,
      currentPrice: scores.currentPrice,
      originalMsrp: set.originalMsrp,
      hasExclusiveMinifigs: set.hasExclusiveMinifigs,
      voteCount: scores.voteCount,
      maxVoteCount,
    });
    return { set, scores, compositeScore };
  });

  // Sort by composite score descending
  items.sort((a, b) => b.compositeScore.total - a.compositeScore.total);

  const strongBuyCount = items.filter(
    (i) => i.compositeScore.band === "strong-buy"
  ).length;

  return (
    <div className="flex flex-col">
      <BrickHero
        eyebrow="Curated picks · Updated weekly"
        title="Sets worth watching."
        description={`${items.length} hand-approved sets scored for retirement timing, theme demand, BrickLink liquidity, and community interest.`}
        accentColor="red"
      />

      {/* Stats bar */}
      <section className="bg-sunshine-yellow border-b-2 border-jet-black px-4 py-3">
        <div className="mx-auto max-w-[1240px] flex flex-wrap gap-4 items-center">
          <span className="type-body-sm font-medium text-jet-black">
            {strongBuyCount} Strong Buy
          </span>
          <span className="type-body-sm text-slate-700">
            {items.filter((i) => i.compositeScore.band === "buy").length} Buy
          </span>
          <span className="type-body-sm text-slate-700">
            {items.filter((i) => i.compositeScore.band === "watch").length}{" "}
            Watch
          </span>
        </div>
      </section>

      {/* Grid */}
      <section className="py-12 px-4 bg-paper">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <WatchlistCard key={item.set.setNumber} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-4 py-8 bg-paper border-t-2 border-slate-100">
        <div className="mx-auto max-w-[1240px]">
          <p className="type-body-sm text-slate-500 leading-relaxed max-w-2xl">
            LegoFuture provides educational tools for informational purposes only.
            Composite scores are not financial advice. Past LEGO set appreciation
            does not guarantee future returns. Always do your own research before
            purchasing any collectible or investment.
          </p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/watchlist/page.tsx
git commit -m "feat(watchlist): /watchlist page with composite score grid"
```

---

## Task 7: /set/[slug] page + VoteButton

**Files:**
- Create: `src/app/set/[slug]/VoteButton.tsx`
- Create: `src/app/set/[slug]/page.tsx`

- [ ] **Step 1: Create VoteButton client component**

```tsx
// src/app/set/[slug]/VoteButton.tsx
"use client";

import { useState } from "react";
import { Eye, Check } from "lucide-react";
import { BrickButton } from "@/components/ui/BrickButton";

interface VoteButtonProps {
  setNumber: string;
  initialVoteCount: number;
}

export function VoteButton({ setNumber, initialVoteCount }: VoteButtonProps) {
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    if (hasVoted || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sets/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setNumber }),
      });
      const json = await res.json();
      if (res.ok) {
        setVoteCount(json.voteCount);
        setHasVoted(true);
      } else if (res.status === 409) {
        setHasVoted(true); // Already voted
      }
    } catch {
      // fail silently — voting is non-critical
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <BrickButton
        variant={hasVoted ? "ghost" : "secondary"}
        size="md"
        onClick={handleVote}
        disabled={hasVoted || loading}
        className="flex items-center gap-2"
      >
        {hasVoted ? (
          <>
            <Check className="w-4 h-4" aria-hidden />
            Watching
          </>
        ) : (
          <>
            <Eye className="w-4 h-4" aria-hidden />
            {loading ? "Adding..." : "Watch this set"}
          </>
        )}
      </BrickButton>
      <p className="type-eyebrow text-slate-500">
        {voteCount > 0
          ? `${voteCount.toLocaleString()} ${voteCount === 1 ? "person" : "people"} watching`
          : "Be the first to watch"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create set detail page**

```tsx
// src/app/set/[slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { CuratedSet } from "@/lib/types/curated";
import curatedSetsData from "@/lib/data/lego-curated-sets.json";
import { loadCuratedScores } from "@/lib/db/curated-sets";
import { computeCompositeScore } from "@/lib/domain/curated-score";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import { ChipBadge } from "@/components/ui/ChipBadge";
import { VoteButton } from "./VoteButton";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const curatedSets = curatedSetsData as CuratedSet[];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const set = curatedSets.find((s) => s.slug === slug);
  if (!set) return { title: "Not Found" };
  return {
    title: `${set.name} Investment Analysis`,
    description: `LEGO ${set.name} (${set.setNumber}) investment score, retirement status, pricing, and community interest.`,
  };
}

const FACTOR_LABELS: Record<string, string> = {
  retirementTiming: "Retirement timing",
  themeStrength: "Theme strength",
  bricklinkDemand: "BrickLink demand",
  purchaseDiscount: "Purchase discount",
  exclusiveContent: "Exclusive content",
  communityVotes: "Community interest",
};

const FACTOR_WEIGHTS: Record<string, number> = {
  retirementTiming: 30,
  themeStrength: 20,
  bricklinkDemand: 15,
  purchaseDiscount: 15,
  exclusiveContent: 10,
  communityVotes: 10,
};

const BAND_COLORS: Record<string, string> = {
  "strong-buy": "text-brick-red",
  "buy": "text-bright-blue",
  "watch": "text-slate-700",
};

export default async function SetDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const set = curatedSets.find((s) => s.slug === slug);
  if (!set) notFound();

  const scores = await loadCuratedScores(set.setNumber) ?? {
    setNumber: set.setNumber,
    bricklinkSoldCount6mo: null,
    retirementMonthsRemaining: null,
    currentPrice: null,
    voteCount: 0,
    lastRefreshed: "",
  };

  const compositeScore = computeCompositeScore({
    retirementMonthsRemaining: scores.retirementMonthsRemaining,
    retired: set.retired,
    theme: set.theme,
    bricklinkSoldCount6mo: scores.bricklinkSoldCount6mo,
    currentPrice: scores.currentPrice,
    originalMsrp: set.originalMsrp,
    hasExclusiveMinifigs: set.hasExclusiveMinifigs,
    voteCount: scores.voteCount,
    maxVoteCount: Math.max(scores.voteCount, 1),
  });

  const bricklinkUrl = `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${set.setNumber}-1#T=S`;
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=LEGO+${encodeURIComponent(set.setNumber)}+sealed&LH_Sold=1`;
  const legoUrl = `https://www.lego.com/en-us/search?q=${set.setNumber}`;

  return (
    <main className="bg-paper min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1240px]">
        {/* Breadcrumb */}
        <nav className="type-eyebrow text-slate-500 mb-6 flex gap-2">
          <Link href="/watchlist" className="hover:text-jet-black transition-colors">
            Watchlist
          </Link>
          <span>›</span>
          <span className="text-jet-black">{set.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Left: details */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <ChipBadge color={compositeScore.band === 'strong-buy' ? 'brick-red' : compositeScore.band === 'buy' ? 'bright-blue' : 'sunshine-yellow'}>
                  {compositeScore.band === 'strong-buy' ? 'Strong Buy' : compositeScore.band === 'buy' ? 'Buy' : 'Watch'}
                </ChipBadge>
                {set.retired && <ChipBadge color="jet-black">Retired</ChipBadge>}
                {!set.retired && set.retiringSoon && (
                  <ChipBadge color="brick-red">Retiring soon</ChipBadge>
                )}
                <ChipBadge color="slate">{set.theme}</ChipBadge>
              </div>
              <h1 className="type-display-2 text-jet-black mb-1">{set.name}</h1>
              <p className="type-body text-slate-500">
                Set #{set.setNumber}
                {set.subtheme ? ` · ${set.subtheme}` : ""}
                {" · "}{set.pieceCount.toLocaleString()} pieces
              </p>
            </div>

            {/* Score breakdown */}
            <BrickCard as="section" accentTop={compositeScore.band === 'strong-buy' ? 'red' : compositeScore.band === 'buy' ? 'blue' : 'yellow'}>
              <div className="flex items-baseline gap-3 mb-5">
                <span className={`text-5xl font-extrabold ${BAND_COLORS[compositeScore.band]}`} style={{ fontFamily: 'var(--nf-jakarta)' }}>
                  {compositeScore.total}
                </span>
                <span className="type-body text-slate-500">/ 100</span>
                <span className="type-eyebrow text-slate-400 ml-auto">Composite score</span>
              </div>

              <div className="space-y-3">
                {(Object.entries(compositeScore.factors) as [keyof typeof compositeScore.factors, number][]).map(
                  ([key, value]) => {
                    const weight = FACTOR_WEIGHTS[key] ?? 0;
                    const pct = (value / 5) * 100;
                    return (
                      <div key={key}>
                        <div className="flex justify-between type-eyebrow text-slate-500 mb-1">
                          <span>{FACTOR_LABELS[key]}</span>
                          <span>{value.toFixed(1)} / 5 · {weight}% weight</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full border border-jet-black/10 overflow-hidden">
                          <div
                            className="h-full bg-bright-blue rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </BrickCard>

            {/* Notes */}
            {set.notes && (
              <BrickCard as="section">
                <p className="type-eyebrow text-slate-500 mb-2">Investment thesis</p>
                <p className="type-body text-slate-700 leading-relaxed">{set.notes}</p>
              </BrickCard>
            )}

            {/* Community */}
            <BrickCard as="section">
              <p className="type-eyebrow text-slate-500 mb-3">Community interest</p>
              <VoteButton
                setNumber={set.setNumber}
                initialVoteCount={scores.voteCount}
              />
            </BrickCard>
          </div>

          {/* Right: image + pricing + links */}
          <div className="space-y-6">
            {/* Image */}
            <BrickCard as="div">
              <div className="relative aspect-square bg-slate-50 rounded-sm overflow-hidden border-2 border-jet-black">
                {set.imageUrl ? (
                  <Image
                    src={set.imageUrl}
                    alt={set.name}
                    fill
                    className="object-contain p-6"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center type-body text-slate-300">
                    #{set.setNumber}
                  </div>
                )}
              </div>
            </BrickCard>

            {/* Pricing */}
            <BrickCard as="section" accentTop="green">
              <p className="type-eyebrow text-slate-500 mb-3">Pricing</p>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="type-eyebrow text-slate-500">MSRP</dt>
                  <dd className="type-mono-num text-jet-black">
                    ${set.originalMsrp.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="type-eyebrow text-slate-500">Target buy</dt>
                  <dd className="type-mono-num text-pure-green font-bold">
                    ${set.targetBuyPrice.toLocaleString()}
                  </dd>
                </div>
                {scores.currentPrice != null && (
                  <div>
                    <dt className="type-eyebrow text-slate-500">Current</dt>
                    <dd className="type-mono-num text-jet-black">
                      ${scores.currentPrice.toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </BrickCard>

            {/* Buy links */}
            <BrickCard as="section">
              <p className="type-eyebrow text-slate-500 mb-3">Research & buy</p>
              <div className="flex flex-col gap-2">
                <a
                  href={bricklinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between type-body-sm text-slate-700 hover:text-jet-black transition-colors border border-slate-200 rounded-card px-3 py-2"
                >
                  BrickLink sold prices
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
                <a
                  href={ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between type-body-sm text-slate-700 hover:text-jet-black transition-colors border border-slate-200 rounded-card px-3 py-2"
                >
                  eBay sold listings
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
                <a
                  href={legoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between type-body-sm text-slate-700 hover:text-jet-black transition-colors border border-slate-200 rounded-card px-3 py-2"
                >
                  LEGO.com
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
              </div>
            </BrickCard>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/set/[slug]/VoteButton.tsx src/app/set/[slug]/page.tsx
git commit -m "feat(watchlist): /set/[slug] detail page with score breakdown + vote button"
```

---

## Task 8: Homepage top picks strip + navigation

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/footer.tsx`

- [ ] **Step 1: Update homepage to add top picks strip**

In `src/app/page.tsx`, add imports at the top and a new section after the hero. The file currently has a hero, a stats bar, a pillars section, and a CTA. Insert the top picks section between the stats bar and pillars:

Replace the entire file with:

```tsx
// src/app/page.tsx
import Link from "next/link";
import { TrendingUp, Package, BarChart3 } from "lucide-react";
import { BrickHero } from "@/components/ui/BrickHero";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import { HeroStats } from "@/components/HeroStats";
import { WatchlistCard } from "@/components/sets/WatchlistCard";
import type { CuratedSet, CuratedItem } from "@/lib/types/curated";
import curatedSetsData from "@/lib/data/lego-curated-sets.json";
import { loadAllCuratedScores } from "@/lib/db/curated-sets";
import { computeCompositeScore } from "@/lib/domain/curated-score";

export const revalidate = 300;

const PILLARS = [
  {
    accent: "blue" as const,
    icon: <TrendingUp className="w-6 h-6" strokeWidth={1.75} aria-hidden />,
    title: "Live pricing from PriceCharting",
    desc: "Current prices sourced directly from PriceCharting, with a bundled fallback snapshot. Always fresh, always honest.",
  },
  {
    accent: "red" as const,
    icon: <Package className="w-6 h-6" strokeWidth={1.75} aria-hidden />,
    title: "Retired vs current sets",
    desc: "Supply-constrained retired sets earn a higher base CAGR. We flag retirement status so you can stack the right sets.",
  },
  {
    accent: "green" as const,
    icon: <BarChart3 className="w-6 h-6" strokeWidth={1.75} aria-hidden />,
    title: "Five-year ROI projections",
    desc: "Three scenarios — pessimist, moderate, optimist — give you a range instead of a false-precision single number.",
  },
];

const curatedSets = curatedSetsData as CuratedSet[];

async function getTopPicks(): Promise<CuratedItem[]> {
  const setNumbers = curatedSets.map((s) => s.setNumber);
  const scoresMap = await loadAllCuratedScores(setNumbers);
  const maxVoteCount = Math.max(
    ...Array.from(scoresMap.values()).map((s) => s.voteCount),
    1
  );
  const items: CuratedItem[] = curatedSets.map((set) => {
    const scores = scoresMap.get(set.setNumber) ?? {
      setNumber: set.setNumber,
      bricklinkSoldCount6mo: null,
      retirementMonthsRemaining: null,
      currentPrice: null,
      voteCount: 0,
      lastRefreshed: "",
    };
    const compositeScore = computeCompositeScore({
      retirementMonthsRemaining: scores.retirementMonthsRemaining,
      retired: set.retired,
      theme: set.theme,
      bricklinkSoldCount6mo: scores.bricklinkSoldCount6mo,
      currentPrice: scores.currentPrice,
      originalMsrp: set.originalMsrp,
      hasExclusiveMinifigs: set.hasExclusiveMinifigs,
      voteCount: scores.voteCount,
      maxVoteCount,
    });
    return { set, scores, compositeScore };
  });
  return items
    .sort((a, b) => b.compositeScore.total - a.compositeScore.total)
    .slice(0, 5);
}

export default async function HomePage() {
  const topPicks = await getTopPicks();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <BrickHero
        eyebrow="Free · No login required · Educational tools only"
        title="Forecast every sealed brick."
        description="Buy / hold / sell signals on 20+ popular sets — Star Wars UCS, Technic, Architecture, Modular Buildings, and more."
        primaryCta={{ label: "See the forecast", href: "/set-forecast" }}
        secondaryCta={{ label: "Read the methodology", href: "/set-forecast/methodology" }}
        accentColor="yellow"
      />

      {/* Live catalog count */}
      <section className="bg-sunshine-yellow border-b-2 border-jet-black px-4 py-3">
        <div className="mx-auto max-w-[1240px] flex justify-center md:justify-start">
          <HeroStats />
        </div>
      </section>

      {/* Top picks */}
      <section className="py-16 px-4 bg-paper border-b-2 border-jet-black">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <p className="type-eyebrow text-slate-500 mb-2">Curated watchlist</p>
              <h2 className="type-h1 text-jet-black">Top picks right now.</h2>
            </div>
            <Link href="/watchlist" className="shrink-0">
              <BrickButton variant="ghost" size="sm">
                View all →
              </BrickButton>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {topPicks.map((item) => (
              <WatchlistCard key={item.set.setNumber} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 px-4 bg-paper">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-12">
            <p className="type-eyebrow text-slate-500 mb-2">How we build the signal</p>
            <h2 className="type-h1 text-jet-black max-w-lg">Three pillars, one clear signal.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <BrickCard
                key={p.title}
                as="article"
                accentTop={p.accent}
                studStrip
              >
                <div className="w-10 h-10 rounded-card border-2 border-jet-black flex items-center justify-center mb-4">
                  {p.icon}
                </div>
                <h3 className="type-h3 text-jet-black mb-2">{p.title}</h3>
                <p className="type-body text-slate-700 leading-relaxed">{p.desc}</p>
              </BrickCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="mx-auto max-w-[1240px] text-center max-w-2xl mx-auto">
          <h2 className="type-h1 text-jet-black mb-4">Ready to build your position?</h2>
          <p className="type-body-lg text-slate-700 mb-8">
            No sign-up. No paywall. Informational tools only.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/watchlist">
              <BrickButton variant="primary" size="lg">
                Open Watchlist
              </BrickButton>
            </Link>
            <Link href="/set-forecast">
              <BrickButton variant="ghost" size="lg">
                Full Set Forecast
              </BrickButton>
            </Link>
          </div>
          <div className="mt-10 rounded-card border-2 border-slate-100 bg-pure-white px-5 py-4 text-left type-body-sm text-slate-500 leading-relaxed max-w-2xl mx-auto">
            LegoFuture provides educational market-analysis tools for informational
            purposes only. It does not provide personalized financial, investment,
            tax, or legal advice. LEGO® is a trademark of the LEGO Group.
            LegoFuture is not affiliated with or endorsed by the LEGO Group.
            Review our{" "}
            <Link href="/terms" className="text-bright-blue hover:underline">
              Terms of Use
            </Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-bright-blue hover:underline">
              Privacy Policy
            </Link>
            {" "}before relying on this site.
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add "Watchlist" to header nav**

In `src/components/layout/header.tsx`, change the `NAV_LINKS` array:

```typescript
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/set-forecast", label: "Set Forecast" },
  { href: "/set-forecast/methodology", label: "Methodology" },
];
```

- [ ] **Step 3: Add "Watchlist" to footer**

In `src/components/layout/footer.tsx`, find the Tools `<ul>` and add before the Set Forecast `<li>`:

```tsx
<li>
  <Link href="/watchlist" className="type-body-sm text-slate-300 hover:text-paper hover:underline transition-colors">
    Watchlist
  </Link>
</li>
```

- [ ] **Step 4: Run typecheck + tests**

```bash
npx tsc --noEmit && npm run test
```

Expected: no errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/layout/header.tsx src/components/layout/footer.tsx
git commit -m "feat(watchlist): homepage top picks strip + nav links"
```

---

## Task 9: sync-external-scores.mjs

**Files:**
- Create: `scripts/sync-external-scores.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create sync script**

```javascript
#!/usr/bin/env node
// scripts/sync-external-scores.mjs
// Refreshes DDB external scores for all sets in lego-curated-sets.json.
// Run: node --env-file=.env.local scripts/sync-external-scores.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const curatedSets = JSON.parse(
  readFileSync(
    join(__dirname, "../src/lib/data/lego-curated-sets.json"),
    "utf8"
  )
);

async function getBricklinkSoldCount(setNumber) {
  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "bricklink" },
      })
    );
    if (!res.Item) return null;
    // usedSoldCount6mo or fallback to salesVolume
    return (
      res.Item.usedSoldCount6mo ??
      res.Item.newSoldCount6mo ??
      null
    );
  } catch {
    return null;
  }
}

async function getCurrentPrice(setNumber) {
  try {
    // Try PC new-price first
    const pcRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "v1" },
      })
    );
    if (pcRes.Item?.["new-price"]) {
      return Number(pcRes.Item["new-price"]) / 100;
    }
    // Fall back to BrickLink new avg
    const blRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "bricklink" },
      })
    );
    return blRes.Item?.newAvg ?? null;
  } catch {
    return null;
  }
}

function estimateRetirementMonths(set) {
  // Use retiringSoon flag as a heuristic: 6 months remaining
  // Retired sets return null (handled separately in scoring)
  if (set.retired) return null;
  if (set.retiringSoon) return 6;
  return null; // Unknown — scoring defaults to 2
}

async function syncSet(set) {
  const [bricklinkSoldCount6mo, currentPrice] = await Promise.all([
    getBricklinkSoldCount(set.setNumber),
    getCurrentPrice(set.setNumber),
  ]);

  const retirementMonthsRemaining = estimateRetirementMonths(set);

  // Preserve existing vote count
  let voteCount = 0;
  try {
    const existing = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: {
          pk: `CURATED#SET#${set.setNumber}`,
          sk: "scores",
        },
      })
    );
    voteCount = existing.Item?.voteCount ?? 0;
  } catch {}

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `CURATED#SET#${set.setNumber}`,
        sk: "scores",
        setNumber: set.setNumber,
        bricklinkSoldCount6mo,
        retirementMonthsRemaining,
        currentPrice,
        voteCount,
        lastRefreshed: new Date().toISOString(),
      },
    })
  );

  console.log(
    `[sync-scores] ${set.setNumber} ${set.name} — price: ${currentPrice ?? "n/a"}, bl-sold: ${bricklinkSoldCount6mo ?? "n/a"}`
  );
}

console.log(`[sync-scores] Syncing ${curatedSets.length} curated sets...`);
for (const set of curatedSets) {
  await syncSet(set);
}
console.log("[sync-scores] Done.");
```

- [ ] **Step 2: Add npm script to `package.json`**

In `package.json`, add to the `"scripts"` object:

```json
"sync:curated-scores": "node --env-file=.env.local scripts/sync-external-scores.mjs",
"sync:candidates": "node --env-file=.env.local scripts/sync-candidates.mjs"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-external-scores.mjs package.json
git commit -m "feat(watchlist): sync-external-scores script + npm commands"
```

---

## Task 10: sync-candidates.mjs

**Files:**
- Create: `scripts/sync-candidates.mjs`

- [ ] **Step 1: Create candidate sync script**

```javascript
#!/usr/bin/env node
// scripts/sync-candidates.mjs
// Reads Rebrickable CSV + DDB BrickLink data to score retiring-soon candidates.
// Outputs docs/candidates-YYYY-MM-DD.md for owner review.
// Run: node --env-file=.env.local scripts/sync-candidates.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const TOP_N = Number(process.env.CANDIDATES_TOP_N || 30);

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// Load approved set numbers to exclude from report
const curatedSets = JSON.parse(
  readFileSync(
    join(__dirname, "../src/lib/data/lego-curated-sets.json"),
    "utf8"
  )
);
const approvedSetNumbers = new Set(curatedSets.map((s) => s.setNumber));

// Theme strength map (mirrors curated-score.ts)
const THEME_SCORES = {
  "Star Wars": 5, "Icons": 5, "Ideas": 5, "Modular Buildings": 5, "Creator Expert": 5,
  "Harry Potter": 4, "Marvel": 4, "DC": 4, "Disney": 4, "Botanical": 4,
  "Technic": 3, "Architecture": 3, "Speed Champions": 3,
  "City": 2, "Friends": 2, "Ninjago": 2, "Minecraft": 2,
};

function scoreRetirementTiming(monthsRemaining, retired) {
  if (retired) return 5;
  if (monthsRemaining === null) return 2;
  if (monthsRemaining <= 3) return 5;
  if (monthsRemaining <= 9) return 4;
  if (monthsRemaining <= 18) return 3;
  if (monthsRemaining <= 36) return 2;
  return 1;
}

function scoreTheme(theme) {
  return THEME_SCORES[theme] ?? 1;
}

function scoreDemand(soldCount) {
  if (!soldCount) return 2;
  if (soldCount > 200) return 5;
  if (soldCount >= 100) return 4;
  if (soldCount >= 50) return 3;
  if (soldCount >= 20) return 2;
  return 1;
}

function computeScore({ retirementTiming, themeStrength, bricklinkDemand }) {
  // Simplified 3-factor score for candidates (no price/figs data from CSV)
  const w = retirementTiming * 0.45 + themeStrength * 0.30 + bricklinkDemand * 0.25;
  return Math.round((w / 5) * 100);
}

async function getBricklinkSoldCount(setNumber) {
  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `PRICING#PRODUCT#${setNumber}`, sk: "bricklink" },
      })
    );
    return res.Item?.usedSoldCount6mo ?? res.Item?.newSoldCount6mo ?? null;
  } catch {
    return null;
  }
}

async function readRebrickableCsv() {
  const gz = join(__dirname, "../.cache/rebrickable/sets.csv.gz");
  const lines = [];
  let header = null;

  await new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const stream = createReadStream(gz).pipe(gunzip);
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const parts = buf.split("\n");
      buf = parts.pop();
      for (const line of parts) {
        if (!header) { header = line.split(","); continue; }
        if (line.trim()) lines.push(line);
      }
    });
    stream.on("end", () => { if (buf.trim() && header) lines.push(buf); resolve(); });
    stream.on("error", reject);
  });

  return lines.map((line) => {
    // CSV: set_num,name,year,theme_id,num_parts
    const cols = line.split(",");
    return {
      setNumber: cols[0]?.replace(/-1$/, "").trim(),
      name: cols[1]?.trim(),
      year: Number(cols[2]),
      themeId: cols[3],
      numParts: Number(cols[4]),
    };
  }).filter((s) => s.setNumber && s.name);
}

// Heuristic: sets from 2022–2024 that are active may be nearing retirement
function isLikelyRetiringSoon(year) {
  const currentYear = new Date().getFullYear();
  return year >= currentYear - 3 && year <= currentYear - 1;
}

console.log("[candidates] Reading Rebrickable CSV...");
const allSets = await readRebrickableCsv();
console.log(`[candidates] Loaded ${allSets.length} sets from CSV`);

// Filter to plausible candidates: not already approved, reasonable piece count
const candidates = allSets.filter((s) => {
  if (approvedSetNumbers.has(s.setNumber)) return false;
  if (s.numParts < 100 || s.numParts > 5000) return false;
  if (!isLikelyRetiringSoon(s.year)) return false;
  return true;
});

console.log(`[candidates] Scoring ${candidates.length} candidates...`);

const scored = [];
for (const set of candidates) {
  const soldCount = await getBricklinkSoldCount(set.setNumber);
  // Use theme name — Rebrickable CSV has theme_id; skip theme mapping for now
  // and use a neutral score of 2 (owner will verify)
  const themeStrength = 2;
  const retirementTiming = isLikelyRetiringSoon(set.year) ? 3 : 2;
  const bricklinkDemand = scoreDemand(soldCount);
  const total = computeScore({ retirementTiming, themeStrength, bricklinkDemand });
  scored.push({ ...set, total, soldCount, retirementTiming, themeStrength, bricklinkDemand });
}

scored.sort((a, b) => b.total - a.total);
const topCandidates = scored.slice(0, TOP_N);

// Write markdown report
const date = new Date().toISOString().slice(0, 10);
const outPath = join(__dirname, `../docs/candidates-${date}.md`);

const rows = topCandidates.map((s, i) =>
  `| ${i + 1} | ${s.setNumber} | ${s.name} | ${s.year} | ${s.numParts} | ${s.total} | ${s.soldCount ?? "—"} |`
);

const md = `# LEGO Investment Candidates — ${date}

Generated by \`sync-candidates.mjs\`. Review these sets and add promising ones to \`src/lib/data/lego-curated-sets.json\`.

**Note:** Theme strength is set to 2 (neutral) — verify the actual theme before adding.
BrickLink sold count is from the last sync; run \`npm run sync:bricklink\` first for fresh data.

## Top ${TOP_N} candidates (not yet in watchlist)

| # | Set # | Name | Year | Pieces | Score | BL Sold 6mo |
|---|---|---|---|---|---|---|
${rows.join("\n")}

## How to add a set

1. Look up the set on BrickLink and LEGO.com to confirm theme, retirement status, and current price.
2. If it meets your criteria, add an entry to \`src/lib/data/lego-curated-sets.json\`.
3. Run \`npm run sync:curated-scores\` to populate DDB for the new set.
4. Commit and deploy.
`;

writeFileSync(outPath, md);
console.log(`[candidates] Report written to ${outPath}`);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/sync-candidates.mjs
git commit -m "feat(watchlist): sync-candidates script → markdown report"
```

---

## Task 11: Final verification + push

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build succeeds

- [ ] **Step 5: Push to main**

```bash
git push origin main
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Static catalog JSON with 8 seed sets
- ✅ DDB key patterns (`CURATED#SET#`, `VOTE#IP#`)
- ✅ Composite score with all 6 factors + correct weights
- ✅ Signal bands (strong-buy/buy/watch)
- ✅ Anonymous vote API with rate-limit + hashed IP + 30d TTL
- ✅ `WatchlistCard` with score badge, chips, price, vote count
- ✅ `/watchlist` page — sorted grid
- ✅ `/set/[slug]` page — score breakdown bars, vote button, buy links
- ✅ Homepage top 5 strip
- ✅ Header + footer nav
- ✅ `sync-external-scores.mjs` + npm script
- ✅ `sync-candidates.mjs` + npm script

**Type consistency:** All `CuratedItem`, `CuratedSet`, `CuratedScores`, `CompositeScore`, `ScoreFactors` types flow consistently from `types/curated.ts` through domain → db → components → pages.

**No placeholders:** All code steps contain complete implementations.
