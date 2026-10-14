# Sunset rollout and recovery — BricksFuture

This branch is a local candidate. No push, deployment, ingestion, schedule dispatch, retraining, credential change, or remote data inspection has been performed.

## Current behavior

Catalog identity, text search, set details and eBay offer drawers remain available. Public prices/history, recommendations, sold liquidity, ROI, rankings and model forecasts are unavailable pending audited data. Curated offline identity is usable without cloud/provider configuration. Unavailable values are null, never refreshed from old caches. No environment flag can restore legacy valuation.

Browse observations use `ebay-asking-v1` keys, USD, new sealed condition, exact set-number matching, sample size, match version and collection time. Ambiguous titles/used/boxes/lots are rejected. `publicationAllowed: false` records require a separate rights review before aggregate publication. Old `ebay-sold`, `medianSoldPrice`, `soldCount`, `soldComps90d` and pricing/history caches remain untouched and quarantined. Active search counts use separate fields and never supply sold liquidity.

PC API/CSV/history/image ingestion and synthetic/backfill entrypoints fail before configuration or writes. `sync-all` preserves independent catalog/eBay jobs and omits PC and synthetic generation. Old models and artifacts remain in Git/storage.

## Before any rollout

1. Reviewer verifies the branch, offline fixtures and retained artifacts. Product owner confirms the contractual cutoff timezone/hour; preparation target remains 20 October 2026 00:00 UTC, subscription end reported as 22 October.
2. Owner supplies sanitized workflow/scheduler definitions. Disable external PC ingestion, images, history/backfill and retrain schedules; inspect deployment build configuration for disabled entrypoints. Workflow contents and operational accounts were deliberately outside this patch.
3. Verify rights separately for identities, prices, images and derived models. No retention/publication license is assumed from a cached row.
4. Verify eBay production approval, actual quota by app/keyset and terms. `EBAY_VERIFIED_DAILY_LIMIT` must be positive; missing configuration makes Browse unavailable. No default quota is invented. The request policy's budget, dedupe and cooldown are process-local; a durable shared allocator is required before enabling multiple workers or concurrent ingestion processes. Single-process guards do not establish a global production quota guarantee.
5. Confirm explicit authorization before push, canary or deployment. No data imports are part of this candidate's validation.

## Local checks

Install with `npm ci --ignore-scripts`. Run `npm test`, `npx tsc --noEmit`, and `npm run lint`. For a network-free font build, set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` to the absolute path of `tests/fixtures/font-responses.cjs`, then run `npm run verify`. This fixture is for verification only; do not deploy an artifact built with mock fonts. Turbopack may require a sandbox exception for its internal compiler port.

Inspect homepage, `/set-forecast`, both buying-list routes and set details: no numerical forecasts, rankings or BUY/HOLD/SELL signals; text search, detail navigation and offers remain. Offers show asking label, currency, condition, collection time and sample of one. No provider credentials: show the offer error state and preserve identity. The API returns unavailable/null rather than treating missing data as zero or refreshing a freshness timestamp.

## Recovery

Restore presentation code only after review and keep the hard PC/legacy sales block, or deploy a corrected degraded presentation. Do not revert to an expired subscription, ambiguous sold rows, synthetic history or model forecasts with unverified training rights. No destructive migration exists to roll back. New asking rows use separate versioned keys; original data remain recoverable under their original keys. Retention and deletion require a reviewed inventory, exact scope, owner authorization and recovery plan.

## Remaining gates

Real eBay approval/quota and licensing are unverified. Global multiworker quota coordination, sanitized schedules, image rights, model training rights and authorized production rollout remain external gates. Offline tests establish behavior, not account entitlement or contractual rights.

## Local implementation review notes

Independent review identified and fixed OAuth 429 Retry-After handling (including standalone-job termination), stalled response bodies escaping the request deadline, ambiguous sealed/multi-set matching, and the baseline generator's legacy sold-row consumption. All have offline regression coverage. The baseline generator is disabled rather than rewriting or deleting its outputs. Build/font mocks do not establish provider availability.
