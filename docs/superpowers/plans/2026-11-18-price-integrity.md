# Price integrity implementation plan

> **For agentic workers:** Use executing-plans, test-first, and independent review.

**Goal:** Address the approved pricing audit without new APIs, quotas or fabricated history.
**Architecture:** Keep existing eBay daily collection and DynamoDB. Tighten matching; rotate all catalog identities; seed previously unpriced items only with strong observations; expose out-of-band candidates for review rather than silently override the existing guard; append accepted observations as source-specific history.
**Tech Stack:** Node, TypeScript, Vitest, DynamoDB, Next.js.
**Spec:** Approved audit from 18 November 2026.

## Constraints
Preserve legacy history and credentials. No synthetic backfill. Keep 50 curated + 600 rotation budget. Existing prices retain 8-listing and 0.5–2x rules; initial prices require 16 listings. No silent repricing of rejected candidates. Unknown timestamps remain unknown.

## Review focus
False bundle matches; unpriced rotation fairness; source date preservation; rejected checks must not become historical prices; existing historical partition compatibility.

## Tasks
- [ ] Add failing policy tests for mixed sets, missing pieces, catalog bootstrap, and real history observations; implement minimal changes.
- [ ] Add freshness regression and remove fake timestamps; expose source/check status safely.
- [ ] Persist accepted daily observations in separate source namespace, reading them without overwriting legacy data; report all discrepant candidates.
- [ ] Run full verify and independent review; push verified commit and publish through available authorized deployment path.

## Implementation notes
Accepted eBay samples use `PRICING#PRODUCT#<set>` / `ebay-history#YYYY-MM-DD`, reusing the existing partition permissions. The reader aggregates latest real observation per month and does not overwrite any legacy rows. Supplemental query failure preserves available legacy history. First observation requires 16 valid distinct listings. All out-of-band candidates appear in the job review queue; no automatic override of the 0.5–2x guard.
