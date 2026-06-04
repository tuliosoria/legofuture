# Real Data Activation — Design Spec

**Date:** 2026-06-04
**Status:** Draft — awaiting user review
**Companion runbook:** `data-context-MVP.md` (already on `main`)
**Source prompt:** user message 2026-06-04 ("LegoFuture — Real Data Activation Prompt")

---

## 1. Goal

Replace every hand-typed value on the user-facing MVP (`/`, `/buying-list/retired`, `/buying-list/non-retired`, `/set-forecast`, `/set-forecast/[slug]`) with values derived from the live data pipeline (DynamoDB → XGBoost → ISR). The pipeline itself already exists; nothing about it needs to be built from scratch. What's missing is:

- Data in DynamoDB (the syncs have never been run with all keys)
- A trained model (current model trains on synthetic targets)
- An **adapter layer** between the screener's DDB-shaped `LegoSet` and the MVP's UI-shaped `LegoSet` (the prompt assumes these are the same type — they are not)
- Wiring on each page (one-line swap is misleading; needs the adapter)
- A deployed retrainer Lambda (scaffold exists, never deployed)

## 2. Non-Goals (out of scope for this spec)

- Expanding the user-facing catalog beyond the 50 curated MVP sets (see §11.A)
- Migrating the DynamoDB key schema or table name
- Modifying the XGBoost feature list in `lego-ml/extract_features.py`
- Touching `/terms`, `/privacy`, `/privacy-rights`, `/api/sets/*` routes
- Deleting `src/lib/data/sets.ts` (kept as fallback + slug-to-setNumber map; see §11.B)

## 3. Current State — Verified

Before designing, I verified the following directly against the repo:

| Claim in prompt | Reality |
|---|---|
| `loadStoredCatalog()` exists, returns `LegoSet[]` | ✓ exists, but returns the **DDB-screener** `LegoSet` from `@/lib/types/lego`, **not** the MVP `LegoSet` from `@/lib/domain/lego-set.ts`. Different shape. |
| `getProductBySlug()` exists | ✓ exists; internally calls `loadStoredCatalog()` then `.find()` — full-scan per call. Acceptable for SSR with `revalidate=3600`; tracked as future optimisation. |
| `forecastForSet(product)` returns LegoSet shape | ✗ Wrong. Signature is `forecastForSet(set, pricing, history, manifest)` and returns `SetForecast` (a forecast object). `computeMlForecast(product, pricing)` is the actual async ML inference. |
| All 7 sync scripts exist | ✓ all present in `scripts/` |
| `npm run sync:history` | Actual name: `sync:pc-history`. Likewise `backfill:history` → `sync:history-snapshot`. |
| ML training script exists | ✓ `lego-ml/train.py` |
| Retrainer Lambda scaffolded | ✓ `infra/lego-ml-retrainer/` |
| `.env.local` has API keys | Partial: `DYNAMODB_TABLE`, `AWS_REGION`, `PRICECHARTING_API_TOKEN`, `REBRICKABLE_API_KEY` ✓. Missing: BrickLink (×4), Brickset (×3), eBay (×2). |
| AWS account configured | ✓ `825081952316`, region `us-east-1` |
| SAM CLI installed | ✗ Not installed locally per `npm run infra:build` self-report |
| Detail-page chart "currently has a heading but no rendered chart" | ✗ `MvpForecastChart.tsx` was built last session and renders a forecast band. Phase 5 reduces to "feed real history into the existing chart." |

The above is the basis of every design decision below.

---

## 4. Architecture — The Adapter Layer (NEW)

This is the most important new component. The prompt's one-line swap glosses over it.

### 4.1 The two `LegoSet` types

```
MVP type (src/lib/domain/lego-set.ts)         DDB-screener type (src/lib/types/lego.ts)
─────────────────────────────────────         ────────────────────────────────────────
id                  (curated slug)            id                  (LEGO set number)
name, setNumber                               name, slug
theme, productType                            theme, themeGroup
year                                          releaseYear, retiredYear
status (Active/Retiring/Retired)              retired (boolean) + retiringSoon (boolean)
msrp                                          originalMsrp
currentPrice (number)                         (derived from ProductPricing)
proj5y, bear, bull (numbers)                  (derived from Forecast)
score, signal, confidence, confLabel          (derived from Forecast + ML)
pieces, communityScore (number), momentum     pieces, era, ...
liquidity (string), priceAgreement (string)   (derived from eBay comps)
thesis (string)                               n/a — hand-curated, kept in sets.ts
```

### 4.2 New module: `src/lib/data/live-catalog.ts`

Single owner of the MVP-shape ↔ live-data adaptation. Public API:

```ts
// Returns the 50 MVP sets in MVP-LegoSet shape, populated from DDB + ML inference.
export async function loadLiveCuratedCatalog(): Promise<MvpLegoSet[]>

// Single set by curated slug — same adaptation pipeline, one row.
export async function loadLiveCuratedSet(slug: string): Promise<MvpLegoSet | null>

// Historical price points for the chart on the detail page.
// Returns rows already filtered + sorted by month ascending.
export async function loadLiveHistory(slug: string): Promise<HistoryPoint[]>
```

Internal pipeline for `loadLiveCuratedCatalog()`:
1. Read the 50-slug → setNumber map from `LEGO_SETS` (static, in `sets.ts`).
2. `BatchGetCommand` on DDB for `CATALOG#PRODUCT#{setNumber}`, `PRICING#PRODUCT#{setNumber}` for all 50 (1 round-trip per ~25 IDs; ≤2 round-trips total).
3. For each set: load 12mo of `HISTORY#PRODUCT#{setNumber}` (parallel BatchGet by month-window or per-set Query).
4. Run `computeMlForecast(ddbProduct, pricing)` per set (uses cached model chunks from DDB; in-process).
5. Adapt to MVP shape using a `toMvpLegoSet(ddbProduct, pricing, history, mlForecast, curatedRow)` function. **The curated row contributes `thesis` (never auto-generated) and falls back for any field DDB doesn't have yet** (e.g. `confidence` if ML hasn't trained).
6. Return array in the same order as `LEGO_SETS`.

### 4.3 Pages stay shape-agnostic

Pages keep importing `LegoSet` from `@/lib/domain/lego-set.ts`. Only the *source* changes:

```ts
// before
import { LEGO_SETS } from "@/lib/data/sets";
// after
import { loadLiveCuratedCatalog } from "@/lib/data/live-catalog";
const LEGO_SETS = await loadLiveCuratedCatalog();
```

This isolates the type reconciliation to one module. Pages never see the DDB type.

### 4.4 Fallback semantics

`loadLiveCuratedCatalog()` is layered so partial pipelines still ship something:

| DDB state | Behaviour |
|---|---|
| No rows for set | Use static `LEGO_SETS` row entirely (current MVP behaviour) |
| CATALOG only, no PRICING | Static `currentPrice` from `sets.ts`; everything else from DDB |
| CATALOG + PRICING, no HISTORY | Real `currentPrice`; `momentum` = `null` ("—" in UI); forecast = heuristic only |
| CATALOG + PRICING + HISTORY < 6 mo | Real values; forecast = heuristic; ML skipped |
| Full data + trained model | Fully live forecast |

This is non-negotiable: we will not have all 50 sets in the highest tier at launch.

---

## 5. Phase 1 — Populate DynamoDB

### 5.1 API-key matrix (what blocks what)

| Sync | Required env | Currently set | If missing |
|---|---|---|---|
| Rebrickable catalog | `REBRICKABLE_API_KEY` | ✓ | Pipeline cannot proceed |
| PriceCharting prices | `PRICECHARTING_API_TOKEN` | ✓ | No `currentPrice`; pipeline degrades to static |
| PriceCharting history | (same key) | ✓ | No `momentum`; ML can't train |
| BrickLink | `BRICKLINK_CONSUMER_KEY/SECRET`, `BRICKLINK_TOKEN_VALUE/SECRET` | ✗ | `priceAgreement` falls back to static |
| Brickset | `BRICKSET_API_KEY/USERNAME/PASSWORD` | ✗ | Retirement metadata enrichment skipped (harmless) |
| eBay | `EBAY_CLIENT_ID/SECRET` | ✗ | `liquidity` falls back to static |
| Trends | none | n/a | Community score loses Trends component |
| Community | none | n/a | Community score loses Reddit component |

**Decision:** Ship Phase 1 with whatever keys are configured. Document the missing-keys gap in the launch checklist. Do not block on them — the fallback layer in §4.4 handles graceful degradation.

### 5.2 Canonical command sequence (corrected names)

```bash
npm run sync:rebrickable      # 1a — catalog
npm run sync:pricecharting    # 1b — current prices
npm run sync:pc-history       # 1c — historical scrape (NOT sync:history)
npm run sync:bricklink        # 1d — BL pricing + validate
npm run sync:bl-validate
npm run sync:ebay             # 1e — eBay sold listings
# (no sync:ebay-comps in package.json — verify if needed)
npm run sync:trends           # 1f
npm run sync:community        # 1g
npm run sync:history-snapshot # 1h — current-month snapshot (NOT backfill:history)
# orchestrated:
npm run sync:all              # idempotent; skips any sync whose env vars are missing
```

`sync:all` already runs the canonical order with checkpointing — prefer it over manual sequencing.

### 5.3 Verification per sync

For each sync, after run:
1. Check `META#SYNC#{SOURCE}#{ts}` row in DDB exists and `status` is success.
2. Spot-check 3 sets (`75192` Millennium Falcon, `10270` Bookshop, `75222` Cloud City) — they should have rows in the expected PK.
3. For Phase 1c (history): count `HISTORY#PRODUCT#{setNumber}` rows; flag any of the 50 with `< 6`.

---

## 6. Phase 2 — ML Training

### 6.1 Standard path

```bash
npm run ml:train  # → python3 lego-ml/train.py
```

Requires Python 3 + deps in `lego-ml/requirements.txt`. Document the pyenv setup in the implementation plan; it's a one-time step.

After run, verify:
- `META#LAST_MODEL_TRAIN` row in DDB has `sampleCount >= 20` and a current timestamp.
- `MODEL#FORECAST#1y`, `MODEL#FORECAST#3y`, `MODEL#FORECAST#5y` chunks exist.

### 6.2 The synthetic-backfill bridge — **with sunset**

The user's prompt suggests synthesising history for sparse sets so the model has something to train on. We adopt this **with three constraints to prevent it becoming permanent pollution**:

1. **Every synthetic row stamped** `source: "synthetic_backfill"` (already a defined `HistorySource` per `lib/db/lego-keys.ts`).
2. **Feature extractor down-weights** synthetic rows: in `lego-ml/extract_features.py`, multiply synthetic-derived feature contributions by 0.4 (one-line change; not adding/removing features, only weighting).
3. **Sunset rule:** when a set accumulates `≥ 6` real (`pricecharting_scrape` or `pricecharting_api`) HISTORY rows, the synthetic rows for that set are deleted on the next `sync:history-snapshot` run. This makes the bridge self-erasing.

Bridge implementation: new script `scripts/synthesise-sparse-history.mjs`:
- For each MVP set with `< 3` real HISTORY rows in DDB:
  - Parse `momentum` from `LEGO_SETS` (e.g. `"+18% 12mo"` → `0.18`).
  - Compute monthly rate `(1 + annual) ^ (1/12) - 1`.
  - Back-fill 24 monthly rows: `price[t-n] = currentPrice / (1 + monthly_rate)^n`.
  - Write to DDB with `source: "synthetic_backfill"`.
- Idempotent: if a synthetic row exists for that month, overwrite; never duplicate.

Run order: `sync:pc-history` first (gets whatever real data is available), then bridge fills the gap.

### 6.3 Training cadence on day one

1. Run `npm run ml:train` once after all syncs complete.
2. Verify the metadata.
3. Only proceed to Phase 3 if `sampleCount >= 20` AND `MODEL#FORECAST#5y` exists.

---

## 7. Phase 3 — Wire Pages to Live Data

### 7.1 Files to change (exact list)

| File | Change |
|---|---|
| `src/lib/data/live-catalog.ts` | **New** — the adapter module from §4.2 |
| `src/lib/data/live-catalog.test.ts` | **New** — tests for fallback layering |
| `src/app/page.tsx` | Replace `LEGO_SETS` import with `await loadLiveCuratedCatalog()` |
| `src/app/buying-list/retired/page.tsx` | Same |
| `src/app/buying-list/non-retired/page.tsx` | Same |
| `src/app/set-forecast/page.tsx` | Same |
| `src/app/set-forecast/[slug]/page.tsx` | Use `loadLiveCuratedSet(slug)` instead of `.find()`; keep `generateStaticParams` reading from `LEGO_SETS` (slug list is intentionally static — 50 known IDs) |
| `src/lib/data/sets.ts` | **Unchanged.** Kept as fallback + slug-to-setNumber registry. |

### 7.2 Page contract

All five pages remain Server Components with `export const revalidate = 3600` (unchanged). The change is purely the data source. `generateStaticParams` still pre-renders 50 detail pages at build because the slug list is the *static* contract — the value of each forecast is what's live.

### 7.3 Test plan for the adapter

`live-catalog.test.ts` unit-tests `toMvpLegoSet()` (pure function) and the fallback layering:
- DDB returns nothing → output matches static `LEGO_SETS` row exactly
- DDB returns PRICING only → `currentPrice` from DDB, `proj5y` from static
- DDB returns full data → all numeric fields from DDB, `thesis` from static
- ML manifest missing → confidence falls back to heuristic

No new integration tests for DDB itself — mocked. Integration is covered by smoke-testing the deployed staging pages.

---

## 8. Phase 4 — Deploy the Retrainer Lambda

### 8.1 Prerequisites

- AWS SAM CLI installed locally (or in CI). If not installed, document install in the plan: `brew install aws-sam-cli`.
- Deploy IAM role has DDB read/write + Lambda deploy permissions on account `825081952316`.
- Container registry (ECR) write access for the Lambda's image.

### 8.2 Steps

```bash
npm run infra:build
cd infra/lego-ml-retrainer
sam deploy --guided   # first time
# subsequent deploys:
sam deploy
```

### 8.3 Verification

```bash
# 1. Manual invoke
aws lambda invoke --function-name lego-ml-retrainer --payload '{}' /tmp/response.json
cat /tmp/response.json   # expect { "ok": true, "sampleCount": N, "horizons": [...] }

# 2. DDB confirms retrain ran
aws dynamodb get-item --table-name legofuture-cache \
  --key '{"pk":{"S":"META#LAST_MODEL_TRAIN"},"sk":{"S":"v1"}}'
# expect Item.timestamp.S to be a recent ISO ts

# 3. EventBridge rule
aws events list-rule-names-by-target --target-arn <lambda-arn>
# expect a single rule with schedule rate(7 days), state ENABLED
```

### 8.4 Risk: this is the only phase that can't run locally

Phase 4 will likely require a human (the user) for the AWS deploy. Plan calls this out and parks Phase 4 behind a "manual deploy required" gate. Phases 1, 2, 3, 5, 6, 7 don't need this.

---

## 9. Phase 5 — Real History in the Chart

`MvpForecastChart` already exists and renders a forecast band. The change is purely additive: a **history line** (months ≤ today) joined to the existing forecast line at `t=0`.

### 9.1 Data flow

```
Detail page (Server Component)
  ├─ await loadLiveHistory(slug)   // new helper in §4.2
  └─ <MvpForecastChart history={...} forecast={...} />
```

Pass history as a prop — no client-side fetch. ISR re-runs the SSR every hour, so the history slice updates with the rest of the page.

### 9.2 Visual rules

- **Blue solid line:** real history rows (`source` starts with `pricecharting_` or `bricklink_`)
- **Blue dotted line:** synthetic rows (visually distinct — honest about what's real)
- **Green solid line:** forecast median, today → +5yr
- **Green band:** bear-bull interpolated terminal envelope
- **Gray dashed:** S&P 500 at 10.5% annual compounded from today (already implemented)

### 9.3 Library

Recharts (already in `package.json`). Do not add another charting dep.

---

## 10. Phase 6 — Computed Momentum & Community Score

### 10.1 Type changes

```ts
// src/lib/domain/lego-set.ts
export interface LegoSet {
  // ...
  momentum: string | null;          // was: string
  communityScore: number | null;    // was: number
}
```

### 10.2 Compute rules

**Momentum** (in `live-catalog.ts` → `toMvpLegoSet`):
```ts
const latest = history.at(-1)?.price;
const yearAgo = history.find(h => h.monthsAgo === 12)?.price;
const momentum =
  latest && yearAgo && yearAgo > 0
    ? formatPct((latest - yearAgo) / yearAgo) + " 12mo"
    : null;
```
If `< 2` rows, return `null` and let UI show "—".

**Community score:**
```ts
const trendsScore = await loadTrendsScore(setNumber);   // 0-100, 3mo avg, null if no data
const communityRating = await loadCommunityRating(setNumber); // 0-100, null if no data
const score =
  trendsScore != null && communityRating != null
    ? Math.round(0.35 * trendsScore + 0.65 * communityRating)
    : trendsScore ?? communityRating ?? null;
```

### 10.3 UI changes

Every component that renders `momentum` or `communityScore`: wrap in `value ?? "—"`. Components affected: `SetCard`, `BuyingListRow`, `WhyThisRating`, `DetailHero`, possibly `ScenarioCards`. Audit and update.

---

## 11. Decisions & Assumptions Log

These are decisions made unilaterally because the user was unavailable. **Flag for user review.**

### A. Catalog scope: stay curated at 50 sets

The Rebrickable sync writes thousands of rows. The MVP user-facing scope is intentionally 50 curated sets. `loadLiveCuratedCatalog()` filters the DDB catalog down to those 50 by joining on `setNumber` from `LEGO_SETS`. If the user wants to open the screener to the full catalog later, that's a separate spec — the live-catalog module is designed to allow it (just remove the filter).

### B. `sets.ts` stays as the slug-and-thesis registry

We do not delete it. It serves three purposes:
1. The 50 slug → setNumber map (used to filter DDB)
2. The hand-written `thesis` for each set (we never auto-generate prose)
3. Fallback for every numeric field when DDB doesn't have data yet

Long-term, `thesis` could migrate to DDB as `CURATED#SET#{slug}` rows; out of scope here.

### C. Synthetic backfill bridge ships, but sunsets itself

See §6.2. Acceptable because the row source is tagged, the feature weighting penalises synthetic data, and it auto-deletes once real data accumulates.

### D. BrickLink / eBay / Brickset keys are nice-to-have, not blockers

Phases 1d, 1e, and Brickset enrichment will SKIP with current `.env.local`. The fallback layer ensures pages still render. Document the gap in the launch checklist; ship without them.

### E. Phase 4 (Lambda deploy) is a manual gate

Phases 1–3 + 5–7 can be implemented and verified locally + on Amplify. Phase 4 requires SAM CLI install and AWS deploy permissions; we will stop after Phase 3+5+6+7 and ask the user to do Phase 4 themselves (or grant deploy creds).

### F. Phase numbering matches the user's prompt

Even though some phases can run in parallel (e.g. 5 and 6 are independent of each other), the spec preserves the user's numbered phases for traceability.

### G. ISR cadence stays at 3600s (1 hour)

The prompt asks for this. No change.

### H. No new charting library, no new ML library, no new AWS service

Per "What NOT to touch".

---

## 12. Open Risks

1. **Rebrickable sync may take 30+ minutes** for the full catalog. Acceptable (one-time). Document the expected runtime in the plan.
2. **PriceCharting rate limits** can throttle the history scraper. Script has retries; allow long runtime; if it dies mid-run, the checkpoint in `META#PRICECHARTING_PROGRESS` (per the prompt) lets us resume.
3. **The 50 curated sets may not all have PriceCharting coverage.** Spot-check from a recent script run is the only way to know. If, say, 15 of 50 have no PC data, the synthetic bridge picks them up.
4. **`loadStoredCatalog()` is a DDB Scan** — slow as the table grows. For 50 sets we'll prefer `BatchGetCommand` on known PKs (in the adapter), avoiding the scan entirely. This is an implementation note, not a design risk.
5. **Two `LegoSet` types** can confuse future maintainers. Mitigation: aggressive comment in `live-catalog.ts` documenting the adapter; consider renaming the screener's type to `DdbLegoSet` in a follow-up.
6. **Python environment for `ml:train`** — if `pyenv`/`venv` isn't set up, the train will fail with import errors. Document setup in the implementation plan; it's one-time.

---

## 13. Verification Matrix

| Phase | Pass condition | How to check |
|---|---|---|
| 1a | All 50 setNumbers from `LEGO_SETS` have CATALOG rows | DDB BatchGet, count = 50 |
| 1b | All 50 have PRICING rows with `newSealed > 0` | Same |
| 1c | ≥ 40 of 50 have `≥ 6` HISTORY rows | Query per set, count |
| 1d | BRICKLINK rows exist (if keys configured) | DDB Query |
| 1e | ≥ 30 of 50 have eBay comps (if keys configured) | Same |
| 1f | TRENDS rows exist for current month | Same |
| 1g | COMMUNITY rows exist | Same |
| 1h | Every PRICING set has a current-month HISTORY row | Cross-join |
| 2 | `META#LAST_MODEL_TRAIN.sampleCount >= 20` AND `MODEL#FORECAST#{1y,3y,5y}` exist | DDB GetItem |
| 3 | All 5 pages render with live data, build green, all tests pass | `npm run build` + `npm test`; spot-check 3 detail pages |
| 4 | Lambda fires on schedule, manual invoke succeeds | AWS console + `aws lambda invoke` |
| 5 | Detail page chart shows blue history line for ≥40 of 50 sets | Manual check on staging |
| 6 | `momentum` / `communityScore` are non-null on real-data sets, "—" on sparse ones | Manual check |
| 7 | `/contact#methodology` copy matches §7 of prompt | Read page |

---

## 14. Implementation Sequencing

Strict order (do not parallelise within the page wiring phase):

1. **Phase 1** — run syncs. (Largely manual; can run in background.)
2. **Phase 2** — train model. Requires Phase 1c data.
3. **Phase 3** — build adapter + swap page imports. **TDD**: write `live-catalog.test.ts` first, then implementation. Requires Phase 1 + 2 done so end-to-end smoke works.
4. **Phase 5** — wire real history into chart. Independent of Phase 6.
5. **Phase 6** — compute momentum + communityScore + null-handle UI. Touches more components than Phase 5; sequence after to keep diffs small.
6. **Phase 7** — copy update on `/contact`. Trivial; last.
7. **Phase 4** — Lambda deploy. Manual; user-driven.

---

## 15. References

- `data-context-MVP.md` — what the pipeline does in production today
- `docs/ddb-schema.md` — single-table key schema
- `docs/history-strategy.md` — history-row source taxonomy
- `lego-ml/README.md` — ML pipeline overview
- `src/lib/db/lego-keys.ts` — key prefix constants (authoritative)
- `src/lib/db/lego-search.ts` — `loadStoredCatalog`, `getProductBySlug` source
- `src/lib/domain/lego-forecast.ts` — `forecastForSet`, `computeMlForecast` source
- `src/lib/domain/lego-set.ts` — MVP `LegoSet` type (the UI contract)
- User prompt 2026-06-04 — original request
