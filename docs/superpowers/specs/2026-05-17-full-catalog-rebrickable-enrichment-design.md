# Full LEGO Catalog Ingestion + Rebrickable Enrichment

**Status:** SUPERSEDED by `2026-05-17-multisource-lego-ml-forecast-design.md` (broader scope: multi-source ingestion, ML training pipeline, continuous retraining).
**Date:** 2026-05-17
**Scope:** Phase 1 + Phase 2 of a larger 5-phase plan to bring LegoFuture data parity with PokeFuture. This spec covers expanding the catalog from 20 curated sets to the full PriceCharting LEGO inventory (~2,000+ products) and enriching every row with Rebrickable metadata.

---

## Problem

LegoFuture displays only **20 LEGO products**, all hand-curated in `src/lib/data/lego-ml/lego-catalog.json`. Two root causes:

1. **The PriceCharting sync script never imports anything.** It calls `https://www.pricecharting.com/api/products?platform=lego` which returns `{"products": [], "status": "success"}` — PriceCharting does not have a single `lego` platform; their taxonomy splits LEGO into per-theme console-names (`LEGO Star Wars`, `LEGO Technic`, `LEGO Icons`, …). The sync script silently writes a `sync_metadata` row reporting "0 products" and exits.
2. **Even if the sync worked, the app wouldn't see the data.** The catalog loader in `src/lib/db/lego-search.ts` reads from DDB partition `pk = "CATALOG"` (which holds the 20 curated rows), while the sync script writes to `pk = "CATALOG#PRODUCT#<id>"`. The two keyspaces never meet.

PokeFuture, by comparison, has 156 sealed products with full per-product metadata (era, expansion, pull rates, community score, multi-provider pricing, chase-card indices) and an 893-row training CSV with 41 engineered features feeding 3 ML models. LegoFuture needs the same foundation, but step one is just **getting the products in the door with enough metadata to forecast them.**

## Goals

- LegoFuture catalog grows from 20 → all PriceCharting LEGO sets (estimated 1,500–2,500 after filters).
- Every catalog row has structured metadata sufficient for the existing forecast model: name, theme, subtheme, set number, release year, piece count, minifig count, original MSRP, retired flag, primary image URL.
- The full ingestion + enrichment pipeline runs end-to-end via a single command (`npm run sync:catalog-full`) and is idempotent.
- The set-forecast page renders thousands of cards without UX regressions (filtering, search, sticky toolbar all still work).
- Sets with insufficient history (< 6 monthly points) render the existing "Insufficient price history" message — they're listed but not forecasted yet. Phase 3 of the master plan will backfill history at scale.

## Non-Goals

- **Phase 3 — historical price backfill at scale.** This spec ingests one snapshot per product (today's prices) and lets monthly cron sweeps accumulate history going forward. Bulk-scraping PriceCharting chart pages for thousands of products is its own design.
- **Phase 4 — ML model training.** The current `lego-forecast.ts` CAGR formula stays in place. Once we have history depth (Phase 3), Phase 4 designs the feature engineering + training pipeline that replaces it.
- **Phase 5 — server-side filtering / virtualized grid.** The dashboard will still pass the full catalog through SSR; we'll measure and address perf in a follow-up only if needed.
- **Pricing accuracy reconciliation across multiple providers** (PokeFuture cross-checks PriceCharting + TCGPlayer). LegoFuture stays single-source on PriceCharting for now.

## Approach

Two coordinated changes:

1. **Fix and broaden the PriceCharting ingestion** so it paginates the full LEGO inventory and writes into the keyspace the app actually reads.
2. **Add a Rebrickable enrichment pass** that joins on set number to fill in piece count, minifig count, theme metadata, and high-resolution images that PriceCharting doesn't provide.

These run as a single pipeline because every PC row needs Rebrickable data to produce a complete `CatalogItem`; ingesting PC without enrichment would leave most rows with null piece counts and unusable themes.

### Architecture

```
                  PriceCharting API                 Rebrickable API
                  (q=lego search)                   (/lego/sets/<num>-1)
                         │                                  │
                         ▼                                  ▼
              fetchPricechartingLegoCatalog()    fetchRebrickableSet(setNum)
                         │                                  │
                         └──────────────┬───────────────────┘
                                        ▼
                            mergeAndNormalize(pc, rebrickable)
                                        │
                                        ▼
                            writeCatalogRow(ddb, item)        ◀── editorial overrides
                            writePricingRow(ddb, item)            from lego-catalog.json
                            writeHistorySnapshot(ddb, item)       (manual MSRP fixes, etc.)
                                        │
                                        ▼
                               sync_metadata { total_products_synced, completed_at }
```

Single pipeline, single npm script, one DDB writer per row type.

### Components

#### 1. `scripts/fetch-pricecharting-lego-catalog.mjs` (new)

Replaces the broken `?platform=lego` call. Paginates `https://www.pricecharting.com/api/products?q=lego&offset=<n>` until two consecutive pages return zero LEGO matches (the search returns mixed video games + LEGO products). Filters per page:

- Keep rows where `console-name` starts with `"LEGO "`.
- Drop rows where `genre` is `"Video Game"` or similar non-physical-product genre.
- Drop rows missing both `product-name` and `id`.

Output: an in-memory array of normalized PC products. Respects 1 req/sec rate limit. Logs progress every 500 rows.

Concurrency / cost: ~2,500 LEGO results across PC, 200 per page → ~13 pages × 1.1s = ~15 seconds.

#### 2. `scripts/fetch-rebrickable-enrichment.mjs` (new)

For each PC product, extract the LEGO set number from `product-name` (regex `#?(\d{4,7})(?:-\d+)?` — PC names look like `"Millennium Falcon UCS #10179"`). Call `https://rebrickable.com/api/v3/lego/sets/<num>-1/` with header `Authorization: key <REBRICKABLE_API_KEY>`. Cache responses on disk in `.cache/rebrickable/` keyed by set number so re-runs are free.

Fields used: `name`, `year`, `theme_id` (resolved via cached `/lego/themes/`), `num_parts`, `set_img_url`, `set_url`. Minifig count comes from `/lego/sets/<num>-1/minifigs/?page_size=1` (the `count` field).

Missing or 404 sets are flagged in the merged record (`enrichmentStatus: "rebrickable-not-found"`) but still ingested with PC data alone. Forecast eligibility downstream will mark them "Insufficient data" if metadata is missing.

Rate limit: Rebrickable free tier is 1 req/sec. With ~2,500 products × 2 calls (set + minifig count) = 5,000 calls = ~90 minutes for a cold run. Subsequent runs use the disk cache, so only new sets pay the price.

#### 3. `scripts/sync-catalog-full.mjs` (new)

Top-level orchestrator. Pseudocode:

```js
const pcProducts = await fetchPricechartingLegoCatalog();        // step 1
const enriched = await Promise.all(                              // step 2 (sequential w/ rate limit)
  pcProducts.map(p => enrichWithRebrickable(p))
);
const overrides = JSON.parse(fs.readFileSync('src/lib/data/lego-ml/lego-catalog.json'));
const finalRows = enriched.map(e => applyOverride(e, overrides[e.setNumber]));
await writeCatalogRows(ddb, finalRows);                          // step 3
await writePricingRows(ddb, finalRows);
await writeHistorySnapshots(ddb, finalRows);
await writeSyncMetadata(ddb, { total_products_synced: finalRows.length, completed_at: now });
```

Idempotent: every write is an unconditional `Put` keyed by `(pk, sk)`, so re-running overwrites.

#### 4. `src/lib/db/lego-search.ts` (modified)

Currently queries `pk = "CATALOG"` and gets 20 rows. Change to query `pk = "CATALOG#PRODUCT#<id>"` via `Scan` with a `begins_with` filter, OR (preferred) restructure writes so the orchestrator above writes both the new `CATALOG#PRODUCT#<id>` rows **and** mirrors them into `pk = "CATALOG", sk = "PRODUCT#<id>"` for cheap query-by-partition reads. Pick the mirror approach — Scan-and-filter at 2,500 rows is a ~100ms hit on every cache miss, while Query by partition is < 30ms. Storage cost difference is trivial (~1MB).

#### 5. `src/lib/data/lego-ml/lego-catalog.json` (purpose changes)

Today: source of truth for the 20-set catalog.
After: editorial **override** file. Keyed by set number, values are partial overrides (e.g., `{"10179": {"originalMsrp": 499.99, "subtheme": "Ultimate Collector Series"}}`). Applied during the merge step. The 20 existing entries are preserved as overrides so the marquee sets keep their hand-curated metadata.

#### 6. Editorial filters (in `sync-catalog-full.mjs`)

Default filters to keep "investment-relevant" sets only:

- `pieceCount >= 50` (drops polybags, brick-pack accessories)
- `originalMsrp >= 5` when known (drops gear, magazines, books PC sometimes mis-tags)
- `console-name` is **not** `"LEGO Games"` (drops the LEGO video game console)
- Manual deny-list at `src/lib/data/lego-ml/sync-denylist.json` for one-off junk that slips through

All filters are configurable via env vars (`SYNC_MIN_PIECES`, etc.) so future runs can loosen them.

## Data Flow

1. **Run** `npm run sync:catalog-full` (manual or scheduled via existing GitHub Actions cron).
2. **Fetch** all `q=lego` paginated results from PC, filter to physical LEGO products.
3. **Enrich** each row in sequence via Rebrickable (disk-cached), respecting rate limit.
4. **Merge** PC + Rebrickable + editorial overrides into the canonical `CatalogItem` shape used by `src/lib/types/lego.ts`.
5. **Write** to DDB: CATALOG row, PRICING row, today's HISTORY snapshot, updated sync_metadata.
6. **Next request** to `/set-forecast` hits the existing 5-minute SSR cache; on cache miss `loadCatalog()` queries `pk = "CATALOG"` and gets the full ~2,000-row catalog.
7. **Dashboard** runs the existing filter pipeline client-side over the larger dataset. Empirically, the `runFilterPipeline()` cost is linear and < 50ms for 2,500 items in modern browsers — no UI changes required.
8. **Forecast eligibility** in `lego-forecast.ts` returns `forecastEligible: false, ineligibleReason: "Insufficient price history (need ≥6 monthly points)"` for the new rows until Phase 3 backfills history. Cards render with `--` for projection values and "Tracking" badge instead of buy/hold/sell signal.

## Error Handling

| Failure | Behavior |
|---|---|
| PriceCharting API returns non-2xx mid-pagination | Retry once with 2s backoff. On second failure, abort with non-zero exit and log `META#FAILURE#<timestamp>` row. Partial DDB writes are fine (idempotent). |
| Rebrickable 429 (rate limit exceeded) | Sleep 60s and retry. Cap at 3 retries per row, then mark `enrichmentStatus: "rebrickable-rate-limited"` and continue. |
| Rebrickable 404 for a set number | Flag `enrichmentStatus: "rebrickable-not-found"`, fall through with PC data only. Common for promotional / exclusive sets PC tracks but Rebrickable hasn't catalogued. |
| Set number regex doesn't match PC `product-name` | Skip enrichment, ingest with PC fields only, flag `enrichmentStatus: "no-set-number"`. |
| DDB `BatchWriteCommand` returns `UnprocessedItems` | Existing exponential-backoff retry in `batchWriteAll()` (already implemented in current sync script — reuse). |
| Missing `REBRICKABLE_API_KEY` env var | Hard fail at script start with a clear message. Don't run the PC half then bail. |

## Testing

No automated tests for the sync scripts themselves — they're side-effecting ingest jobs with external dependencies. Instead:

- **Unit test** `mergeAndNormalize(pc, rebrickable, override)` in `scripts/lib/merge-catalog.test.mjs` with fixture pairs covering: (a) full PC + full Rebrickable + override; (b) PC only (no set number match); (c) PC + 404 Rebrickable; (d) override-only field (MSRP); (e) piece-count filter rejection.
- **Smoke test** `scripts/sync-catalog-full.mjs --dry-run --limit=50` mode that fetches 50 PC products, runs the full merge pipeline, writes a JSON report to `tmp/sync-dry-run.json`, and asserts: 50 rows in, 50 rows out (or rows + reason for drops).
- **Verification script** `scripts/verify-catalog-coverage.mjs` (new) that reads from DDB and reports: total catalog rows, % with each metadata field present (`pieceCount`, `minifigCount`, `originalMsrp`, `theme`, `imageUrl`), % forecast-eligible. Run after every sync to confirm health.
- **Run `npm run verify`** (existing lint + build + `--passWithNoTests`) to ensure no TypeScript regressions in `lego-search.ts` and the new types if any are introduced.

## Open Decisions Made (with rationale)

The user was unavailable to clarify these — capturing decisions explicitly so they're reviewable:

1. **"All products" scope.** Default = LEGO physical sets only, ≥50 pieces OR ≥$5 MSRP, excluding `LEGO Games` console. Polybags and minifig packs excluded because their forecast signal is noisy and they dilute the "investment-grade set" narrative. Tunable via env vars; user can loosen later.
2. **Rebrickable API key.** Required env var `REBRICKABLE_API_KEY`. User must obtain one (free, instant at https://rebrickable.com/api/). Script hard-fails without it.
3. **Storage migration strategy.** Mirror writes into both `pk="CATALOG"` (for cheap Query) and `pk="CATALOG#PRODUCT#<id>"` (for direct-by-id lookups). Costs ~2× write capacity (on-demand pricing makes this negligible) but keeps both the existing app code and the unrestricted sync script's keyspace populated.
4. **Editorial overrides retention.** Keep `lego-catalog.json` as an override layer. The 20 curated entries become MSRP / subtheme fixes applied during merge.
5. **History at ingest time.** Write today's PC prices as a HISTORY snapshot during the sync (matches existing behavior in `sync-pricecharting-to-dynamo.mjs`). One data point isn't enough to forecast but seeds the monthly accumulation.

If the user wants to revise any of these after reading the spec, the architecture supports it cleanly — the merge/filter logic is the only code that needs to change.
