# Monthly prices and best buys: activation gate

## Verified 2026-11-09

Repository default head: `5efa290cc0b1fa025ad641df4e94e0e50a3a944b`.
No monthly sync workflow is tracked at this head. README's nightly YAML is an example, not an installed job. Remote workflow-list inspection was rejected by the connector's allowed-endpoint validator, so no claim is made about external schedulers.

The public catalog intentionally blocks pricing and sold-price rankings after the PriceCharting sunset. The supplied checkout has no verified November price update. This work adds honest monthly readiness on the home, catalog and buying-list pages and health endpoint. It does **not** refresh prices, activate automation, or restore rankings. A changing calendar month is not a data-update receipt.

Run `node scripts/monthly-readiness.mjs` using Node >=22.18. The offline diagnostic emits JSON and exits 2 (blocked). It reads no secrets, does no networking, and writes no data. Do not schedule this diagnostic and call it a sync.

## Candidate: eBay asking-price estimates

A LEGO offer-based edition is technically feasible: exact set number and edition, new/sealed condition only, fixed-price single sets, one currency/market, known shipping, deduplicated listings. Reject lots, boxes, accessories, incompatible versions, used/incomplete sets and uncertain matches. Label all outputs “asking-price estimate,” never completed sales, liquidity, market value or investment forecast. A best-offer ranking needs a documented scoring method and minimum comparable sample; return unavailable rather than zero or a synthetic estimate when those fail.

Source review on 2026-11-09:
- [eBay API license](https://developer.ebay.com/join/api-license-agreement), section 8: listing display must remain within six hours of the eBay information, with age disclosure; remove information no longer publicly available. Derived statistics and public-display restrictions need review for the exact proposed use. The general agreement is **not evidence of this app's permission**.
- [Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html): production eligibility and approval cannot be inferred from possessing keys. No account, keyset, effective quota or approval was inspected.

A monthly scheduler alone is therefore insufficient for offers. Use a monthly **selection edition** plus on-demand/bounded refresh of the displayed listings within provider limits. Expired or withdrawn offers disappear from public results without advancing the edition's last successful-data timestamp. No live calls are enabled by this patch.

## Remaining implementation and acceptance gates

1. Verify the actual app's production access, allowed display/derivation/retention, marketplace and shared quota without exposing credentials. Do not buy a subscription or accept agreements as part of this work.
2. Approve the exact offer-based methodology for LEGO. Monthly snapshots or aggregates require their own allowed-retention check, not an assumption based on listing access.
3. Implement a bounded provider adapter, exact identity matching, timestamped observation schema, partial-failure handling and withdrawal revalidation. Existing Browse methods remain disabled and existing legacy import scripts must not be used to bypass that gate.
4. Add an idempotent month key and distributed lock; stage the entire candidate edition and atomically publish only after validation. A failed run preserves the prior edition and its original observation timestamps. Store sanitized attempt/result metadata separately from success metadata; never put raw tokens or provider payloads in logs.
5. After an authorized canary succeeds, configure the real monthly runner for `17 5 1 * *` (05:17 UTC, first day monthly), manual dispatch, concurrency, timeout, least-privilege credentials and visible failure alerts. A schedule file is not proof of execution. Verify a real run, its persisted edition, and public UI before claiming activation. Refresh offers independently within their display-age ceiling.
6. Review, authorize push/deploy and inspect the deployed pages. None performed here.

November 2026 stays blocked until these gates pass. No historical values were replaced, no monthly data was fabricated, and no recurring cost was created.
