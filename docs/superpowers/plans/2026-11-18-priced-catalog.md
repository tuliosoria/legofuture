# Priced catalog without invented classifications

## Problem and decision
DynamoDB catalog rows often lack investmentUniverse. Preserve explicit classification (PR7), but do not fabricate it or broaden the investment filter. The current website serves a separate curated selection; the reusable ForecastDashboard was not mounted on any route.

Expose a real /catalog page linked from /set-forecast. Default to All sets (priced eligible rows, both active/retired), neutral observed-price cards, and retain strict explicit investment/tracker/collector modes. Explain unclassified sets and give an All sets escape when classified results are empty. API default remains unchanged for compatibility; client sends mode=all explicitly. No data/IAM changes, no collector inventory backfill.

## Guardrails
- No automatic investment classification, score promotion, or Top Buys in All sets.
- Catalog cards link only to known curated detail IDs, not DDB slugs unsupported by real detail routes.
- Do not display estimated price as observed price.
- Loading failures must show error/retry, never pretend an empty catalog.
- Ignore stale fetch results after newer filter requests.
- Client-side sorting describes loaded results, not a full-catalog global ranking.
- Existing pricing-provider eligibility remains; inclusion is not endorsement.

## Verification and release
Regression tests for field preservation, page mount, initial API mode, unclassified display, strict classification, links, request failure/retry and ordering races. Full lint/tests/build, independent review, then integrate. Coordinate a single Amplify deploy and verify the live /catalog route, curated-page link, and API mode=all with real prices. Do not claim default investment has classified rows where none exist.
