# Sunset rollout and recovery — BricksFuture

This branch is a release candidate. On 15 October 2026 the user authorized publication preparation, a feature-branch push and PR after checks. Merge and rollout remain coordinated by the root operator; this preparer has performed no deploy, live ingestion, schedule dispatch, retraining or credential/IAM change.

## Current behavior

Catalog identity, text search, set details and eBay offer drawers remain available. Public prices/history, recommendations, sold liquidity, ROI, rankings and model forecasts are unavailable pending audited data. Curated offline identity is usable without cloud/provider configuration. Unavailable values are null, never refreshed from old caches. No environment flag can restore legacy valuation.

Browse observations use `ebay-asking-v1` keys, USD, new sealed condition, exact set-number matching, sample size, match version and collection time. Ambiguous titles/used/boxes/lots are rejected. `publicationAllowed: false` records require a separate rights review before aggregate publication. Old `ebay-sold`, `medianSoldPrice`, `soldCount`, `soldComps90d` and pricing/history caches remain untouched and quarantined. Active search counts use separate fields and never supply sold liquidity.

PC API/CSV/history/image ingestion and synthetic/backfill entrypoints fail before configuration or writes. `sync-all` preserves independent catalog/eBay jobs and omits PC and synthetic generation. Old models and artifacts remain in Git/storage.

## Active-listing display age

The [eBay API License Agreement §8.1(c), Age of Displayed eBay Content](https://developer.ebay.com/join/api-license-agreement) distinguishes item listing information (no more than 6h older than the eBay site) from other eBay content (24h). It also requires disclosure when the listing shown is less current than the site. This is not a universal 24h listing TTL.

Our conservative local display policy caps eBay asking observations at 6h since `observedAt`, even when a caller requests 24h. Stricter limits remain effective. Exactly 6h is eligible; 6h+1ms is withheld. New `fetchedAt`, cache reads and errors cannot renew `observedAt`. The open drawer also expires retained offers without refetching. Timestamp/collection age must be shown; validating freshness relative to the site and the required disclosure remains a pre-activation gate. This change does not enable live APIs, alter token TTL/daily quota reset, or make asking prices sold/market values.

[§8.1(b), Public Display](https://developer.ebay.com/join/api-license-agreement) requires removal from the application when content is no longer publicly available on eBay. Before enabling display, review detection, immediate public suppression and the applicable removal/retention procedure. This is an operational gate, not an authorization to delete retained artifacts; none were deleted here.

## Before any rollout

1. Reviewer verifies the branch, offline fixtures and retained artifacts. Product owner confirms the contractual cutoff timezone/hour; preparation target remains 20 October 2026 00:00 UTC, subscription end reported as 22 October.
2. Coordinator reported AWS weekly retrain rule `DISABLED` (rate 7 days, Lambda `legofuture-ml-retrainer`) and no GitHub workflows in this repository. These are coordinator-supplied operational observations; the preparer did not inspect accounts. Keep the rule disabled. Any further scheduler work remains coordinated separately.
3. Verify rights separately for identities, prices, images and derived models. No retention/publication license is assumed from a cached row.
4. Verify eBay production approval, actual quota by app/keyset and terms. `EBAY_VERIFIED_DAILY_LIMIT` must be positive; missing configuration makes Browse unavailable. No default quota is invented. The request policy's budget, dedupe and cooldown are process-local; a durable shared allocator is required before enabling multiple workers or concurrent ingestion processes. Single-process guards do not establish a global production quota guarantee.
5. Feature push/PR is now authorized after local checks; root coordinates merge/canary/deployment. No data imports are part of this candidate's validation.

## Local checks

Install with `npm ci --ignore-scripts`. Run `npm test`, `npx tsc --noEmit`, and `npm run lint`. For a network-free font build, set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` to the absolute path of `tests/fixtures/font-responses.cjs`, then run `npm run verify`. This fixture is for verification only; do not deploy an artifact built with mock fonts. Turbopack may require a sandbox exception for its internal compiler port.

Inspect homepage, `/set-forecast`, both buying-list routes and set details: no numerical forecasts, rankings or BUY/HOLD/SELL signals; text search, detail navigation and offers remain. Offers show asking label, currency, condition, collection time and sample of one. No provider credentials: show the offer error state and preserve identity. The API returns unavailable/null rather than treating missing data as zero or refreshing a freshness timestamp.

## Recovery

Restore presentation code only after review and keep the hard PC/legacy sales block, or deploy a corrected degraded presentation. Do not revert to an expired subscription, ambiguous sold rows, synthetic history or model forecasts with unverified training rights. No destructive migration exists to roll back. New asking rows use separate versioned keys; original data remain recoverable under their original keys. Retention and deletion require a reviewed inventory, exact scope, owner authorization and recovery plan.

## Remaining gates

Real eBay approval/quota and licensing are unverified. Global multiworker quota coordination, sanitized schedules, image rights, model training rights and authorized production rollout remain external gates. Offline tests establish behavior, not account entitlement or contractual rights.

## Local implementation review notes

Independent review identified and fixed OAuth 429 Retry-After handling (including standalone-job termination), stalled response bodies escaping the request deadline, ambiguous sealed/multi-set matching, and the baseline generator's legacy sold-row consumption. All have offline regression coverage. The baseline generator is disabled rather than rewriting or deleting its outputs. Build/font mocks do not establish provider availability.

## Clean release artifact

`node scripts/prepare-sunset-deploy.mjs` is local-only: it audits the real standalone build and creates a fresh `.sunset-deploy-*` Amplify layout without AWS calls. It refuses retained price/model/media markers and mock-font artifacts. It excludes all `public/`, environment files, caches and retained source files from the copy while leaving originals unchanged. Do not use the older upload/deploy script for assembly because it blindly copies public assets. Target for root-controlled rollout: app `d2lnw5t0h096c1` (`legofuture-compute`), `us-east-1`.

The release uses an explicit 50-set identity-only allowlist, without importing retained financial datasets, media overrides or model bundles. Public forecast and catalog facades have no runtime import of the retained implementations. Browse is hard-disabled independently of inherited environment values, including standalone collection entrypoints. Lack of written PC redistribution/retention evidence remains recorded; no license is inferred from storage or subscription access.
