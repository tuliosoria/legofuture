# LegoFuture — Curated Watchlist Design

**Date:** 2026-05-31
**Status:** Approved for implementation

---

## Problem

legofuture.com does not need a full LEGO catalog. It needs a small, curated list of high-conviction investment picks — retired or active sets with strong valorization potential. The current site either shows the wrong sets or too few. The scoring model and community engagement layer are missing.

---

## Approach

Hybrid static catalog + dynamic scores. Approved sets live in a committed JSON file. A sync script pulls retiring-soon candidates from BrickEconomy/Rebrickable and outputs a diff report for owner review. External signal scores and anonymous community votes are stored in DynamoDB and refresh independently of deploys.

---

## Architecture

### 1. Static approved catalog
`src/lib/data/lego-curated-sets.json`

Source of truth for which sets appear on the site. Each entry is hand-approved by the owner, committed to git. Only sets in this file appear on the site.

Each entry shape:
```json
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
}
```

### 2. DynamoDB key patterns (new, in existing `legofuture-cache` table)

| PK | SK | Contents |
|---|---|---|
| `CURATED#SET#{setNumber}` | `scores` | BrickEconomy rating, BrickLink 6mo sold count, retirement months remaining, external composite score, last refreshed |
| `VOTE#IP#{hashedIp}` | `SET#{setNumber}` | timestamp, TTL = 30 days |
| `CURATED#SET#{setNumber}` | `vote-count` | total vote count, last updated |

### 3. Sync scripts (two new scripts)

**`scripts/sync-candidates.mjs`**
- Reads Rebrickable CSV catalog (already cached at `.cache/rebrickable/sets.csv.gz`) for sets flagged as retiring soon or recently retired
- Cross-references BrickLink sold volume (existing `sync-bricklink-pricing.mjs` data in DDB) for demand signal
- Scores each candidate using the 6 external factors
- Outputs `docs/candidates-YYYY-MM-DD.md` — a ranked report with scores and buy recommendation
- Does NOT scrape BrickEconomy directly (respects ToS); "BrickEconomy rating" column in report is our own computed score
- Owner reviews, picks sets, adds to `lego-curated-sets.json`, commits

**`scripts/sync-external-scores.mjs`**
- Reads approved sets from `lego-curated-sets.json`
- Refreshes BrickEconomy rating, BrickLink sold volume, retirement window for each
- Writes updated external scores to `CURATED#SET#{setNumber}` / `scores` in DDB
- Runs weekly via cron

### 4. Next.js pages (new/updated)

| Route | Description |
|---|---|
| `/` | Homepage: hero + "Top picks right now" strip (top 5 by composite score) |
| `/watchlist` | Full curated list: card grid, filter by theme/status, sort by score/retirement/price |
| `/set/[slug]` | Set detail: score breakdown, price history, 7-factor table, vote button, buy links |

---

## Composite Score (0–100)

External signals = 90% of score at launch (community votes start at 0 and grow over time).

| Factor | Weight | Source | Scale |
|---|---|---|---|
| Retirement timing | 30% | BrickEconomy / Rebrickable | Retiring ≤3mo=5, ≤9mo=4, ≤18mo=3, ≤36mo=2, >36mo=1 |
| Theme strength | 20% | Static mapping | Star Wars/Icons/Ideas/LOTR/Modular=5, HP/Marvel/Disney=4, Technic/Architecture=3, City/Friends=2, Other=1 |
| BrickLink sold volume (6mo) | 15% | BrickLink sync | >200=5, 100-200=4, 50-100=3, 20-50=2, <20=1 |
| Purchase discount vs MSRP | 15% | PriceCharting | ≥30%=5, 20-29%=4, 10-19%=3, 0-9%=2, above MSRP=1 |
| Exclusive minifigs / display value | 10% | Rebrickable + manual flag | Exclusive figs=5, display set=4, standard=2 |
| Community votes (hashed IP, 30d TTL) | 10% | DDB | Normalized 0-5 against max votes in catalog |

**Signal bands:**
- ≥75 → **Strong Buy** (brick red)
- 55–74 → **Buy** (bright blue)
- <55 → **Watch** (sunshine yellow)

---

## Community Vote

- Anonymous, no login
- One vote per hashed IP per set, 30-day TTL (can re-vote after 30 days)
- Stored in DDB: `VOTE#IP#{sha256(ip)}` / `SET#{setNumber}`
- Vote count stored in `CURATED#SET#{setNumber}` / `vote-count`, incremented atomically
- API route: `POST /api/sets/vote` — body `{ setNumber }`, reads IP from request headers
- Rate limit: 5 votes per IP per minute (existing `rate-limit.ts` handles this)

---

## UI — Key Components

**WatchlistCard** (new component)
- Set image, name, theme chip, retirement status chip
- Composite score badge (color-coded by band)
- Current price + target buy price
- "X watching" community count
- Links to `/set/[slug]`

**SetDetailPage** (`/set/[slug]`)
- Score breakdown: horizontal bar per factor, weighted contribution visible
- Price history chart (existing `ForecastChart` adapted)
- 7-factor table with values and weights
- Vote button: "I'm watching this set" → animates to "X people watching"
- Buy links: BrickLink, eBay sold listings, LEGO.com

**Homepage strip** (update to existing `page.tsx`)
- "Top picks right now" section: 5 `WatchlistCard`s sorted by composite score
- Replaces or supplements current pillars section

---

## What Is Not In Scope

- User accounts or persistent watchlists
- Price alerts or email notifications
- Admin UI for approving sets (sync script + git workflow handles this)
- Full LEGO catalog browsing (existing `/set-forecast` page stays as-is)
- BrickEconomy scraping (use their public retiring-soon page only, respect robots.txt)

---

## Initial Curated Set List (seed)

Sets from the owner's brief to seed `lego-curated-sets.json`:

| Set # | Name | Theme | MSRP |
|---|---|---|---|
| 75382 | UCS TIE Interceptor | Star Wars | $229.99 |
| 75407 | Star Wars Brick-Built Logo | Star Wars | $59.99 |
| 75394 | Imperial Star Destroyer | Star Wars | $169.99 |
| 75389 | The Dark Falcon | Star Wars | $143.99 |
| 75361 | Spider Tank | Star Wars | $49.99 |
| 10309 | Succulents | Icons | $49.99 |
| 75426 | Millennium Falcon (midi) | Star Wars | $99.99 |
| 75418 | Star Wars Advent Calendar 2025 | Star Wars | $44.99 |

Additional sets should be added via `sync-candidates.mjs` output.
