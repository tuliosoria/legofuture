# BricksFuture eBay Price Source Implementation Plan

**Goal:** Prices from eBay (daily), sunset undone, forecasts/buying lists live for November 2026.
**Spec:** docs/superpowers/specs/2026-11-12-ebay-price-source-design.md

## Global Constraints
- Rule: accept eBay median only when activeCount >= 8 and 0.5 <= p50/lastKnown <= 2; else keep lastKnown. Never write 0/NaN/null.
- No banner, no "asking price" label. PriceCharting history stays.
- Never call PriceCharting. Commits end with the Copilot trailer. `npm run verify` before push.

## Review Focus
- Products whose search returns minifigs/instructions/lots (price far below set) — band + title filters must hold the last price.
- A run where eBay auth/quota fails must write nothing.
- Curated sets without a DynamoDB product must still get the eBay price.
- Score adjustment must not produce NaN when proj5y or price is 0.
- Pages must stay ISR (no forced dynamic).

### Task 1: Undo the sunset
Restore e3486b4 for src/, tests/, next.config.ts, eslint, tsconfig; delete sunset-only files; amplify.yml pre-sunset minus PRICECHARTING_API_TOKEN; drop live PriceCharting fallback in lego-estimate.ts. Test: `npm run verify`.

### Task 2: eBay price row in the merge
`mergePricingRows`: row sk=`ebay-median` with numeric `price` > 0 wins newPrice, adds source "ebay-median"; lastFetched prefers its capturedAt. live-catalog: curated sets without DDB product read `getPricingFromDdb(setNumber)`. Tests in tests/lib/domain/lego-estimate-merge.test.ts and src/lib/data/live-catalog.test.ts.

### Task 3: Refresh script
scripts/lib/ebay-price-policy.mjs (`decideEbayPrice`, `isSetListing`, `summarizePrices`, `buildWorkList`, `collectionLooksBroken`), scripts/refresh-ebay-prices.mjs (CLI `--dry-run`, `--limit`, `--rotation`). Tests tests/scripts/ebay-price-policy.test.ts.

### Task 4: Price-aware score
src/lib/domain/price-adjusted-score.ts `adjustScoreForPrice(curated, live)`; applied in toMvpLegoSet. Tests.

### Task 5: Copy, docs, workflow
Methodology/privacy/terms copy; AGENTS.md section; ADR superseded; README; .github/workflows/refresh-ebay-prices.yml; package.json script.

### Task 6: Live run + deploy
OIDC role + secrets; run refresh; verify; merge; Amplify job; smoke.
