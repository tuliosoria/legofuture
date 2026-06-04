# Phase 1 Sync Report — 2026-06-04

**Account:** `825081952316`  **Region:** `us-east-1`  **Table:** `legofuture-cache`

## DDB state at execution time

The table was already populated by prior sync runs on 2026-05-17.
No bulk syncs were re-run as part of this implementation pass — the
existing data is recent enough (~2.5 weeks) to ship against, and the
adapter's fallback layer handles any per-set gaps.

| Prefix | Row count |
|---|---|
| `CATALOG#PRODUCT#` | 31,272 |
| `PRICING#PRODUCT#` | 4,444 |
| `HISTORY#PRODUCT#` | 6,403 |
| `MODEL#` | **0** (will be populated by Task 4 / Phase 2) |

## Schema notes (correcting plan assumptions)

- `CATALOG#PRODUCT#{X}` and `PRICING#PRODUCT#{X}` use **PriceCharting product IDs** (e.g. `5890187`), not LEGO set numbers.
- `HISTORY#PRODUCT#{X}` uses the **LEGO set number** (e.g. `75192`).
- `HISTORY` SK format is `{condition}#{YYYY-MM-DD}` where `condition` ∈ `new-sealed | complete | loose`. Most data is `complete` (CIB).
- The `loadStoredCatalog()` screener function exposes a `setNumber` field on each row that maps to the LEGO set number — this is the correct join key for the MVP-50.
- The adapter (`live-catalog.ts`, Task 5) handles this by scanning the screener catalog once and building a map keyed by `setNumber`.

## 50 MVP set coverage (CATALOG-by-setNumber-field, via Task 5 adapter logic)

Spot-checked HISTORY rows by LEGO set number — 8 of 50 have ≥ 6
history rows in DDB (`complete` condition is the most common source).
The synthetic-backfill bridge (Task 2) covers the other 42.

## Provider key status

| Provider | Key configured | Coverage on 50 MVP |
|---|---|---|
| Rebrickable | ✓ | n/a (catalog spine) |
| PriceCharting | ✓ | partial (`newSealed` populated for ~30 of 50 by setNumber match) |
| BrickLink | ✗ (4 keys missing) | n/a |
| Brickset | ✗ (3 keys missing) | n/a |
| eBay | ✗ (2 keys missing) | n/a |
| Google Trends | ✓ (no key needed) | rows exist for top 10 set numbers |
| Community | ✓ (no key needed) | sparse |

## Action items before broader launch

- [ ] Add BrickLink keys (4) to `.env.local` → unlocks priceAgreement
- [ ] Add Brickset keys (3) → unlocks retirement metadata enrichment
- [ ] Add eBay keys (2) → unlocks liquidity field with real comp depth
- [ ] Schedule a quarterly re-run of `sync:pricecharting` + `sync:pc-history`
- [ ] After Task 14: confirm the EventBridge weekly retrainer is firing
