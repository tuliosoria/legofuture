# Local sunset implementation evidence — 14 October 2026

Candidate base: `d80d613` (documentary sunset plan); fetched `origin/main`: `e3486b4`. No remote advancement was found. The three `lf-plan-*` remote branches are ancestors of main, with no unique deltas. Worktree branch: `implement/pricecharting-sunset`.

## Verification

- `npm ci --ignore-scripts`: success. No ingestion lifecycle scripts executed. Existing dependency audit reports 22 vulnerabilities (1 low, 4 moderate, 14 high, 3 critical); dependency remediation is outside this semantic patch.
- Contract, product, ingestion, UI, provider health and review regressions followed RED→GREEN with offline fixtures.
- `npm test`: 29 files / 255 tests passed.
- `npx tsc --noEmit`: exit 0. Corrected three existing test fixture typing issues so the full check can run.
- `npm run verify` with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` pointing to `tests/fixtures/font-responses.cjs`: exit 0 (lint, complete suite, production build). Lint reports three existing unused-disable warnings; Next reports the existing middleware-to-proxy deprecation.
- Plain build initially failed because Google Fonts could not be fetched. The committed local font fixture validates compilation/prerendering offline without changing production fonts. Turbopack's internal compiler port required approved local sandbox escalation. Do not deploy an artifact using this font fixture.
- `node --check` on both eBay sync scripts, `bash -n scripts/sync-all.sh`, and `git diff --check`: exit 0.
- Generated homepage, catalog, retired list and one set-detail HTML contain the suspension notice and do not serialize `proj5y` or `Strong Buy`.

## Preserved and changed

Legacy stored prices/history, PC cache rows, mislabeled eBay sold rows, curated source datasets, images and models remain untouched. New Browse aggregate writes use separate asking keys; failed reads produce no replacement count/price/timestamp. Public valuation/history/model consumption is suspended. Existing manual calculation/domain tests still run. Identity catalog/search and offer navigation remain usable without provider configuration.

Independent reviewer regressions fixed: OAuth 429 honors Retry-After; standalone OAuth quota/auth terminates ingestion; deadlines cover headers and body; matching rejects negated sealed language, bags-only, multiple set IDs and edition mismatches; baseline legacy valuation generation is blocked.

## Gates and limitations

No live provider, credential, production, import, retrain, push, merge or deployment was exercised. eBay entitlement/quota and all relevant publication/image/model rights remain unverified. Budget/deduplication/cooldown are process-local, so shared multiworker coordination is a production gate. Workflow contents and external schedules require sanitized owner review before rollout; no schedule was changed. See `sunset-runbook.md` and `provider-artifact-manifest.md` for the operational and licensing gates.

## Follow-up: six-hour listing display ceiling

The eBay display-age correction uses the [official API License Agreement §8.1(c)](https://developer.ebay.com/join/api-license-agreement): listing information has a 6h ceiling relative to the site; other content has a separate 24h rule. Local asking display is conservatively capped at 6h since observation, preserves stricter caller limits and never renews from cache fetch time. The drawer withholds expired offers, including an offer expiring while open, without refetching or deleting storage. §8.1(b) removal of no-longer-public content is documented as a pre-activation gate; no retained artifacts were deleted.

RED→GREEN: two observation and two drawer regressions reproduced the old behavior. Focused checks: 18 tests passed. Full suite after this change: 30 files / 261 tests passed; TypeScript and lint exit 0 (same three existing warnings); `git diff --check` clean. No provider activation, token TTL or daily quota reset changed. The earlier offline build result above predates this focused follow-up; UI rendering is covered by the new component tests and TypeScript check.

## Release preparation — 15 October 2026

Fetched `origin/main` remains `e3486b4`; no concurrent remote advancement. User authorized release preparation and, after checks, feature push/PR. Root coordinates merge and AWS rollout to app `d2lnw5t0h096c1` (`legofuture-compute`), `us-east-1`. Root reported weekly Lambda retrain rule disabled and no repository GitHub workflows. This preparer made no AWS changes, ingestion calls or deployment.

Real `npm run verify` passed without mock-font configuration: 32 test files / 265 tests, lint exit 0 (two existing warnings), optimized Next build with 50 detail pages and real WOFF2 assets. Separate `npx tsc --noEmit` and `git diff --check` passed. A generated deployment copy initially entered ESLint's source scan; lint/TypeScript now explicitly exclude only generated `.sunset-deploy-*` directories.

Audit found runtime imports could still package retained model bundles, financial catalog fields and media overrides on the server. Public facades now import only identity-safe data; original implementations remain in `.retained.ts` files and original datasets/models stay untouched. Public methodology/source copy accurately states suspension. Browse and its standalone collectors are explicitly disabled regardless of inherited configuration.

`prepare-sunset-deploy.mjs` assembles a local-only Amplify layout in a fresh ignored `.sunset-deploy-*` directory. It copies real standalone/static build outputs, excludes public media, environment files, caches and retained files, audits server/client chunks and maps for retained content markers and requires real WOFF2 assets. Positive/negative packaging regressions passed; originals were not removed. No upload/deploy exists in this preparer. Use its audited output rather than the older deploy script's broad source/public copying. No PC redistribution or post-subscription retention license has been inferred.
