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
