# BricksFuture pricing review — 12 November 2026

## Existing migration

Reviewed main `58ab4d6`: PriceCharting live and derived ingestion remain disabled;
retained historical prices are not deleted. The new daily eBay workflow checks 50
curated sets plus a 600-set rotation. Runtime merges current eBay observations
before retained historical prices. Rankings respond to current prices.

## Scope of this correction

Apply the same data-integrity protections as PokéFuture PR #19, adapted to LEGO.
Preserve the existing threshold (8 observations), range (0.5–2 times reference),
request budget and history. No new API, quota increase, provider subscription,
credential, infrastructure or live collection is part of this patch.

1. Filter exact numeric set identity and reject multi-set/multi-unit bundles,
   non-complete sets and used items before price aggregation.
2. Count unique item identities with valid USD fixed-price/new observations,
   not duplicated variants or raw search results. Ignore malformed numeric data.
3. Persist an accepted eBay observation with its true observation timestamp,
   including unchanged prices. On rejection, retain only a genuine prior eBay
   observation; record the check without relabeling a legacy fallback as eBay.
4. Regression tests first, then full lint/test/build and independent review.

The alternative of copying the Pokémon matcher is unsuitable: LEGO set numbers,
parts, minifigures and multi-set bundles require LEGO-specific identity rules.
The API filter alone is insufficient evidence for currency/condition/identity.

## Operational limits

Source code and passing tests do not prove production deploy or live coverage.
`AGENTS.md` reports Amplify main auto-build disabled; publication therefore needs
an explicit authorized release and verification of the expected commit. Do not
claim the new code is deployed solely because it is merged. Existing historical
rows are preserved. A rejected refresh does not fabricate an updated market price.

## Verification and findings

- Reproduced the original bundle, used-item, duplicate and missing-provenance gaps
  with failing tests before correction.
- Independent review found one false-positive condition filter: "never opened".
  Added regression cases and corrected contextual negation; "opened box never
  used" remains rejected.
- Final `npm run verify`: 271 tests in 25 files passed; build passed. Lint has
  zero errors and three pre-existing unused-disable warnings.
- Existing workflow run 43296744365 on `58ab4d6` succeeded on 12 November:
  70 sets checked (50 curated), 63 accepted, 5 thin, 2 out-of-band, 70 rows written.
  This is evidence for the prior integration, not a live run of this correction.
- No live refresh, AWS action, or deployment was performed for this patch.
