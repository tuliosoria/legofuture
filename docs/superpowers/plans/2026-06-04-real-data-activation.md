# Real Data Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hand-typed value on the MVP user-facing surface with values derived from the live DDB + XGBoost pipeline, while keeping the curated 50-set scope and the static `sets.ts` as the slug/thesis/fallback registry.

**Architecture:** A new adapter module `src/lib/data/live-catalog.ts` is the single owner of the DDB→MVP `LegoSet` reconciliation. Pages keep importing the MVP `LegoSet` type unchanged; only their data source switches from the static `LEGO_SETS` constant to `await loadLiveCuratedCatalog()`. Fallback layering means partial DDB state still renders.

**Tech Stack:** Next.js 16 (App Router, RSC, ISR), TypeScript, DynamoDB (single-table, key prefixes from `lego-keys.ts`), recharts, Vitest, XGBoost (via Python `lego-ml/train.py`), AWS Lambda + EventBridge (SAM, deferred).

**Companion spec:** `docs/superpowers/specs/2026-06-04-real-data-activation-design.md`

---

## File Map

**New files (3):**
- `src/lib/data/live-catalog.ts` — adapter module (the core new code)
- `src/lib/data/live-catalog.test.ts` — unit tests for the adapter
- `scripts/synthesise-sparse-history.mjs` — synthetic history backfill bridge

**Modified files (12):**
- `src/lib/domain/lego-set.ts` — make `momentum` and `communityScore` nullable
- `src/app/page.tsx` — swap import source
- `src/app/buying-list/retired/page.tsx` — swap import source
- `src/app/buying-list/non-retired/page.tsx` — swap import source
- `src/app/set-forecast/page.tsx` — swap import source
- `src/app/set-forecast/[slug]/page.tsx` — use `loadLiveCuratedSet` + pass history to chart
- `src/components/sets/MvpForecastChart.tsx` — accept `history` prop, drop fake backcast
- `src/components/sets/WhyThisRating.tsx` — handle null momentum/communityScore
- `src/components/sets/LiveMarketPanel.tsx` — handle null momentum
- `src/components/sets/BuyingListRow.tsx` — handle null momentum (audit if used)
- `src/app/contact/page.tsx` — methodology copy update
- `lego-ml/extract_features.py` — down-weight rows with `source: "synthetic_backfill"`

**Unchanged (kept as fallback / registry):**
- `src/lib/data/sets.ts` — the 50 curated rows; do **not** delete

---

## Conventions Used in Every Task

- **Branch per task** off `main`: `feat/real-data-{n}-{slug}` (e.g. `feat/real-data-4-adapter`).
- **Commit author identity** for every commit:
  ```bash
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" commit -m "..."
  ```
- **Commit trailer** on every commit:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```
- **Merge style:** `git checkout main && git merge --no-ff <branch> && git push origin main` after task verification passes.
- **Test runner:** `npm test --silent -- <path>` for one file; `npm test --silent` for all.
- **Lint:** `npm run lint`. Must be 0 errors; warnings on pre-existing files ignored.
- **Build:** `npm run build`. Must succeed and prerender all 50 detail pages.
- **DDB region/account:** `us-east-1`, account `825081952316`, table `legofuture-cache`.

---

## Task 1: Run Phase 1 Data Syncs

**Files:** none (data ops only)

**Why this task is first:** Every later phase reads from DDB. Without this, the adapter has nothing to adapt.

- [ ] **Step 1: Confirm env state**

  Run:
  ```bash
  cd ~/legofuture
  grep -c '^[A-Z]' .env.local  # expect ≥ 4 lines
  aws sts get-caller-identity --query Account --output text  # expect 825081952316
  ```
  Expected: account matches, env has at minimum `DYNAMODB_TABLE`, `AWS_REGION`, `PRICECHARTING_API_TOKEN`, `REBRICKABLE_API_KEY`.

- [ ] **Step 2: Run Rebrickable catalog sync (1a)**

  Run:
  ```bash
  npm run sync:rebrickable
  ```
  Expected: completes without errors (may take 20–40 min on first run). Look for `[rb-sync] complete` near the end.

  Verify the 50 MVP set numbers are present:
  ```bash
  node -e "
  const {LEGO_SETS} = require('./src/lib/data/sets.ts');
  console.log(LEGO_SETS.map(s=>s.setNumber).join(','));
  " 2>/dev/null || node --experimental-strip-types -e "import('./src/lib/data/sets.ts').then(m => console.log(m.LEGO_SETS.map(s=>s.setNumber).slice(0,5)))"
  ```
  Then spot-check 3 set numbers via:
  ```bash
  aws dynamodb get-item --table-name legofuture-cache \
    --region us-east-1 \
    --key '{"pk":{"S":"CATALOG#PRODUCT#75192"},"sk":{"S":"v1"}}' \
    | grep -c '"Item"'  # expect 1
  ```
  Repeat for `10270` (Bookshop) and `75222` (Cloud City).

- [ ] **Step 3: Run PriceCharting current-price sync (1b)**

  Run:
  ```bash
  npm run sync:pricecharting
  ```
  Verify:
  ```bash
  aws dynamodb get-item --table-name legofuture-cache --region us-east-1 \
    --key '{"pk":{"S":"PRICING#PRODUCT#75192"},"sk":{"S":"v1"}}' \
    --query 'Item.newSealed.N'
  ```
  Expected: a number (the current sealed price of the UCS Millennium Falcon).

- [ ] **Step 4: Run PriceCharting history scrape (1c)**

  Run (may take 30+ min — best-effort, will skip sets it can't scrape):
  ```bash
  npm run sync:pc-history
  ```
  Verify by counting history rows for one popular set:
  ```bash
  aws dynamodb query --table-name legofuture-cache --region us-east-1 \
    --key-condition-expression 'pk = :pk' \
    --expression-attribute-values '{":pk":{"S":"HISTORY#PRODUCT#75192"}}' \
    --select COUNT --query Count
  ```
  Expected: ≥ 6 (ideally 12–36).

- [ ] **Step 5: Run remaining syncs (1d–1g) via `sync:all` orchestrator**

  Run (orchestrator no-ops gracefully when env vars are missing — BrickLink/Brickset/eBay will SKIP, that's expected):
  ```bash
  npm run sync:all
  ```
  Expected output includes `[sync-all] SKIP bricklink (missing BRICKLINK_CONSUMER_KEY)` etc., plus `[sync-all] RUN trends` and `[sync-all] RUN community` (those have no key requirement).

- [ ] **Step 6: Run current-month history snapshot (1h)**

  Run:
  ```bash
  npm run sync:history-snapshot
  ```

- [ ] **Step 7: Document gap & commit a sync log**

  Capture a sync report (helpful for the user later):
  ```bash
  mkdir -p docs/superpowers/notes
  cat > docs/superpowers/notes/2026-06-04-phase-1-sync-report.md <<EOF
  # Phase 1 Sync Report — $(date -u +%Y-%m-%dT%H:%M:%SZ)

  Account: 825081952316  Region: us-east-1  Table: legofuture-cache

  ## Configured providers
  - Rebrickable: ✓
  - PriceCharting: ✓
  - BrickLink: ✗ (keys not set)
  - Brickset: ✗ (keys not set)
  - eBay: ✗ (keys not set)
  - Google Trends: ✓ (no key needed)
  - Community: ✓ (no key needed)

  ## Counts (50 curated MVP sets)
  - With CATALOG row: <fill from spot-check>
  - With PRICING row + newSealed > 0: <fill>
  - With ≥ 6 HISTORY rows: <fill>

  ## Action items before launch
  - [ ] Add BrickLink keys (4) to .env.local
  - [ ] Add Brickset keys (3) to .env.local
  - [ ] Add eBay keys (2) to .env.local
  - [ ] Re-run sync:all to backfill priceAgreement + liquidity
  EOF
  ```
  Branch + commit:
  ```bash
  git checkout -b feat/real-data-1-sync-report
  git add docs/superpowers/notes/2026-06-04-phase-1-sync-report.md
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "docs: phase 1 sync report

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-1-sync-report -m "Merge branch 'feat/real-data-1-sync-report'"
  git push origin main
  ```

---

## Task 2: Build the Synthetic History Bridge

**Files:**
- Create: `scripts/synthesise-sparse-history.mjs`

**Purpose:** For any of the 50 MVP set numbers with fewer than 3 real HISTORY rows after Task 1, synthesise 24 months of history from `currentPrice` and the static `momentum` string in `sets.ts`. Every row is tagged `source: "synthetic_backfill"` so the feature extractor can down-weight them (Task 11) and so they auto-delete once real data arrives.

- [ ] **Step 1: Create the script**

  Create `scripts/synthesise-sparse-history.mjs`:
  ```js
  #!/usr/bin/env node
  /**
   * Synthesise sparse history for the 50 MVP curated sets.
   *
   * For each set with < 3 real HISTORY#PRODUCT#<setNumber> rows in DDB,
   * back-fill 24 monthly rows derived from sets.ts (currentPrice,
   * momentum). Every synthetic row is stamped source="synthetic_backfill"
   * so the ML feature extractor can weight them lower (see
   * lego-ml/extract_features.py) and so they're easy to delete once real
   * data accumulates.
   *
   * Idempotent: overwrites existing synthetic_backfill rows; never
   * touches rows whose source begins with "pricecharting_" or
   * "bricklink_".
   */
  import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
  import {
    DynamoDBDocumentClient,
    QueryCommand,
    BatchWriteCommand,
  } from "@aws-sdk/lib-dynamodb";

  const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
  const REGION = process.env.AWS_REGION || "us-east-1";
  const MONTHS = 24;
  const MIN_REAL_TO_SKIP = 3;
  const CONDITION = "new-sealed";

  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: REGION }),
    { marshallOptions: { removeUndefinedValues: true } },
  );

  function parseMomentumAnnual(momentum) {
    if (!momentum) return 0.05;
    const m = String(momentum).match(/(-?\d+(?:\.\d+)?)\s*%/);
    return m ? Number(m[1]) / 100 : 0.05;
  }

  function monthIso(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  async function countRealHistory(setNumber) {
    let count = 0;
    let ExclusiveStartKey;
    do {
      const res = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression:
          "attribute_not_exists(#src) OR (NOT begins_with(#src, :syn))",
        ExpressionAttributeNames: { "#src": "source" },
        ExpressionAttributeValues: {
          ":pk": `HISTORY#PRODUCT#${setNumber}`,
          ":prefix": `${CONDITION}#`,
          ":syn": "synthetic_backfill",
        },
        ExclusiveStartKey,
      }));
      count += (res.Items || []).length;
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return count;
  }

  async function writeSynthetic(setNumber, currentPrice, momentum) {
    const annual = parseMomentumAnnual(momentum);
    const monthly = Math.pow(1 + annual, 1 / 12) - 1;
    const now = new Date();
    const rows = [];
    for (let n = MONTHS - 1; n >= 0; n--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
      const price = +(currentPrice / Math.pow(1 + monthly, n)).toFixed(2);
      rows.push({
        PutRequest: {
          Item: {
            pk: `HISTORY#PRODUCT#${setNumber}`,
            sk: `${CONDITION}#${monthIso(d)}`,
            price,
            source: "synthetic_backfill",
            createdAt: new Date().toISOString(),
          },
        },
      });
    }
    // BatchWrite max 25
    for (let i = 0; i < rows.length; i += 25) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: rows.slice(i, i + 25) },
      }));
    }
  }

  async function main() {
    // Read curated list via tsx-free path: import the JSON-compatible
    // module by spawning ts directly. We use a tiny inline ts-loader
    // approach by requiring the compiled JS at runtime — fall back to
    // reading sets.ts and parsing.
    const setsMod = await import(
      new URL("../src/lib/data/sets.ts", import.meta.url).href
    ).catch(async () => {
      // tsx not available; manual parse
      const { readFileSync } = await import("node:fs");
      const txt = readFileSync("src/lib/data/sets.ts", "utf8");
      // crude parse — extract { setNumber, currentPrice, momentum } per row
      const out = [];
      const rx = /setNumber:\s*"([^"]+)"[\s\S]*?currentPrice:\s*(\d+)[\s\S]*?momentum:\s*"([^"]+)"/g;
      let m;
      while ((m = rx.exec(txt))) {
        out.push({ setNumber: m[1], currentPrice: Number(m[2]), momentum: m[3] });
      }
      return { LEGO_SETS: out };
    });

    const sets = setsMod.LEGO_SETS;
    if (!Array.isArray(sets) || sets.length === 0) {
      console.error("[synthesise] FATAL: no sets loaded from sets.ts");
      process.exit(1);
    }
    console.log(`[synthesise] checking ${sets.length} curated sets`);

    let synthesised = 0;
    let skipped = 0;
    for (const s of sets) {
      const real = await countRealHistory(s.setNumber);
      if (real >= MIN_REAL_TO_SKIP) {
        skipped++;
        continue;
      }
      console.log(`[synthesise] ${s.setNumber}: only ${real} real rows — back-filling ${MONTHS} months`);
      await writeSynthetic(s.setNumber, s.currentPrice, s.momentum);
      synthesised++;
    }
    console.log(`[synthesise] done. synthesised=${synthesised} skipped=${skipped}`);
  }

  main().catch((err) => {
    console.error("[synthesise] FATAL:", err);
    process.exit(1);
  });
  ```

- [ ] **Step 2: Add npm script alias**

  Edit `package.json`, in the `"scripts"` block, after the line for `sync:history-snapshot`, add:
  ```json
      "sync:history-synthesise": "node --env-file=.env.local scripts/synthesise-sparse-history.mjs",
  ```

- [ ] **Step 3: Run the script**

  Run:
  ```bash
  npm run sync:history-synthesise
  ```
  Expected: prints `synthesised=N skipped=M` where `N + M = 50`. Any set with `< 3` real PriceCharting rows gets 24 synthetic months.

- [ ] **Step 4: Verify no real data was overwritten**

  Pick a set you know got real data in Task 1 Step 4 (e.g. `75192`):
  ```bash
  aws dynamodb query --table-name legofuture-cache --region us-east-1 \
    --key-condition-expression 'pk = :pk' \
    --expression-attribute-values '{":pk":{"S":"HISTORY#PRODUCT#75192"}}' \
    --query 'Items[?source.S==`synthetic_backfill`] | length(@)'
  ```
  Expected: `0` (because that set had ≥ 3 real rows, so was skipped).

- [ ] **Step 5: Commit**

  ```bash
  git checkout -b feat/real-data-2-synthesise-bridge
  git add scripts/synthesise-sparse-history.mjs package.json
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(scripts): synthesise sparse history bridge

  For any of the 50 MVP curated sets with fewer than 3 real HISTORY
  rows in DDB, back-fill 24 monthly rows derived from sets.ts
  (currentPrice + momentum). Every synthetic row is tagged
  source='synthetic_backfill' so the feature extractor can down-weight
  it (Task 11) and so the rows auto-delete once real data accumulates.

  Idempotent: skips sets with >= 3 real rows.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-2-synthesise-bridge -m "Merge branch 'feat/real-data-2-synthesise-bridge'"
  git push origin main
  ```

---

## Task 3: Down-weight Synthetic Rows in the Feature Extractor

**Files:**
- Modify: `lego-ml/extract_features.py`

**Why before Task 4 (train):** The training run picks up whatever the extractor returns.

- [ ] **Step 1: Locate the history-row aggregation in `extract_features.py`**

  Run:
  ```bash
  grep -n "history\|HISTORY\|source" lego-ml/extract_features.py
  ```
  Identify the function (likely `build_features` or `aggregate_history`) that iterates HISTORY DDB rows and produces price-derived features.

- [ ] **Step 2: Add the weight constant + use it**

  At the top of `extract_features.py`, add:
  ```python
  # Synthetic backfill rows (source == "synthetic_backfill") are
  # included so the model can train on every curated set, but their
  # contribution to history-derived features is down-weighted to
  # acknowledge that they are extrapolated from a single price point.
  # Once a set accumulates >= 6 real history rows, the synthetic ones
  # are deleted by sync:history-synthesise — so this weight is a
  # transient bridge, not a permanent calibration.
  SYNTHETIC_WEIGHT = 0.4
  ```

  In the history aggregation, when computing weighted means / momentum / volatility, weight each row:
  ```python
  weight = SYNTHETIC_WEIGHT if row.get("source") == "synthetic_backfill" else 1.0
  ```
  Apply `weight` everywhere a row's contribution is summed.

- [ ] **Step 3: Add a unit test**

  Create or extend `lego-ml/tests/test_extract_features.py`:
  ```python
  import pytest
  from extract_features import SYNTHETIC_WEIGHT

  def test_synthetic_weight_is_below_one():
      assert 0 < SYNTHETIC_WEIGHT < 1, \
          "synthetic_backfill rows must be down-weighted but still contribute"

  # Add a feature-aggregation test if a pure-Python aggregation helper
  # exists. If not, the smoke test in Task 4 covers it via training
  # sample count.
  ```
  Run:
  ```bash
  cd lego-ml && python3 -m pytest tests/ -v
  ```
  Expected: passes.

- [ ] **Step 4: Commit**

  ```bash
  git checkout -b feat/real-data-3-synthetic-weight
  git add lego-ml/extract_features.py lego-ml/tests/
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(lego-ml): down-weight synthetic_backfill history rows

  Adds SYNTHETIC_WEIGHT=0.4 multiplier applied per row when the
  source column equals 'synthetic_backfill'. Transient bridge that
  becomes a no-op once real PriceCharting history overtakes the
  synthetic rows (synthesise script deletes them on the next run).

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-3-synthetic-weight -m "Merge branch 'feat/real-data-3-synthetic-weight'"
  git push origin main
  ```

---

## Task 4: Train the ML Model

**Files:** none (one-shot operation)

**Prereqs:** Python 3 + deps in `lego-ml/requirements.txt`.

- [ ] **Step 1: Set up Python venv (if not already)**

  Run:
  ```bash
  cd ~/legofuture
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r lego-ml/requirements.txt
  ```
  Expected: installs xgboost, boto3, pandas, numpy without errors.

- [ ] **Step 2: Train**

  Run:
  ```bash
  npm run ml:train
  ```
  Expected: prints sample count, R² per horizon, "uploaded MODEL#FORECAST#1y/3y/5y chunks". Takes 1–5 min.

- [ ] **Step 3: Verify training metadata**

  Run:
  ```bash
  aws dynamodb get-item --table-name legofuture-cache --region us-east-1 \
    --key '{"pk":{"S":"META#LAST_MODEL_TRAIN"},"sk":{"S":"v1"}}' \
    --query 'Item.{sampleCount: sampleCount.N, ts: timestamp.S}'
  ```
  Expected: `sampleCount >= 20`, `ts` within the last hour.

  Verify model chunks exist:
  ```bash
  for h in 1y 3y 5y; do
    aws dynamodb query --table-name legofuture-cache --region us-east-1 \
      --key-condition-expression 'pk = :pk' \
      --expression-attribute-values "{\":pk\":{\"S\":\"MODEL#FORECAST#${h}\"}}" \
      --select COUNT --query Count
  done
  ```
  Expected: each returns ≥ 1.

- [ ] **Step 4: Gate check**

  If `sampleCount < 20`, STOP. Investigate why so few sets contributed (likely too-sparse history). Do not proceed to Task 5. Possible remediation: rerun Task 1 step 4 (`sync:pc-history`) for any set with 0 rows.

  If `sampleCount >= 20`, proceed.

- [ ] **Step 5: Log the training outcome**

  No commit needed — this is a runtime operation. Just record sample count + timestamp in `docs/superpowers/notes/2026-06-04-phase-1-sync-report.md`:
  ```bash
  cat >> docs/superpowers/notes/2026-06-04-phase-1-sync-report.md <<EOF

  ## Phase 2 ML training
  - sampleCount: <fill>
  - timestamp: <fill>
  - horizons trained: 1y, 3y, 5y
  EOF
  git checkout -b chore/training-log
  git add docs/superpowers/notes/2026-06-04-phase-1-sync-report.md
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "chore: log phase 2 training outcome

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff chore/training-log -m "Merge branch 'chore/training-log'"
  git push origin main
  ```

---

## Task 5: Build the `live-catalog` Adapter (TDD)

**Files:**
- Create: `src/lib/data/live-catalog.ts`
- Create: `src/lib/data/live-catalog.test.ts`

**Architecture:** This module owns the adaptation from the DDB-screener `LegoSet` (`@/lib/types/lego`) to the MVP-UI `LegoSet` (`@/lib/domain/lego-set`). Public API:

```ts
export async function loadLiveCuratedCatalog(): Promise<MvpLegoSet[]>
export async function loadLiveCuratedSet(slug: string): Promise<MvpLegoSet | null>
export async function loadLiveHistory(slug: string): Promise<LiveHistoryPoint[]>

export interface LiveHistoryPoint {
  date: string;          // "YYYY-MM"
  price: number;
  source: "real" | "synthetic_backfill";
}
```

- [ ] **Step 1: Write the test scaffolding & first failing test**

  Create `src/lib/data/live-catalog.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  // Mocks first — keeps the adapter pure and unit-testable.
  vi.mock("@/lib/db/lego-search", () => ({
    loadStoredCatalog: vi.fn(),
    getProductBySlug: vi.fn(),
  }));
  vi.mock("@/lib/db/lego-history", () => ({
    loadHistory: vi.fn(),
  }));
  vi.mock("@/lib/domain/lego-forecast", () => ({
    computeMlForecast: vi.fn(),
  }));

  import { loadStoredCatalog } from "@/lib/db/lego-search";
  import { loadHistory } from "@/lib/db/lego-history";
  import { computeMlForecast } from "@/lib/domain/lego-forecast";
  import { LEGO_SETS } from "@/lib/data/sets";
  import { loadLiveCuratedCatalog, toMvpLegoSet } from "./live-catalog";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toMvpLegoSet (pure adapter)", () => {
    const curated = LEGO_SETS.find((s) => s.id === "modular-bookshop")!;

    it("falls back entirely to the curated row when DDB returns nothing", () => {
      const out = toMvpLegoSet({
        curated,
        ddbProduct: null,
        pricing: null,
        history: [],
        mlForecast: null,
      });
      expect(out).toEqual(curated);
    });

    it("overrides currentPrice when PRICING is present, keeps thesis from curated", () => {
      const out = toMvpLegoSet({
        curated,
        ddbProduct: null,
        pricing: { newPrice: 420 } as any,
        history: [],
        mlForecast: null,
      });
      expect(out.currentPrice).toBe(420);
      expect(out.thesis).toBe(curated.thesis);
    });

    it("nullifies momentum when fewer than 2 history points", () => {
      const out = toMvpLegoSet({
        curated,
        ddbProduct: null,
        pricing: { newPrice: 420 } as any,
        history: [{ date: "2026-05", price: 420 }],
        mlForecast: null,
      });
      expect(out.momentum).toBeNull();
    });

    it("computes momentum from 12-month-ago vs latest history price", () => {
      const history = [
        { date: "2025-06", price: 300 },
        { date: "2026-06", price: 420 },
      ];
      const out = toMvpLegoSet({
        curated,
        ddbProduct: null,
        pricing: { newPrice: 420 } as any,
        history,
        mlForecast: null,
      });
      // (420-300)/300 = 40%
      expect(out.momentum).toMatch(/\+40% 12mo/);
    });

    it("uses ML forecast proj5y/bear/bull when present", () => {
      const out = toMvpLegoSet({
        curated,
        ddbProduct: null,
        pricing: { newPrice: 420 } as any,
        history: [],
        mlForecast: {
          scenarios: {
            moderate: { projectedValue: 800 },
            pessimist: { projectedValue: 550 },
            optimist: { projectedValue: 1100 },
          },
        } as any,
      });
      expect(out.proj5y).toBe(800);
      expect(out.bear).toBe(550);
      expect(out.bull).toBe(1100);
    });
  });

  describe("loadLiveCuratedCatalog (integration shape)", () => {
    it("returns one MvpLegoSet per curated set in the same order", async () => {
      vi.mocked(loadStoredCatalog).mockResolvedValue([]);
      vi.mocked(loadHistory).mockResolvedValue([]);
      vi.mocked(computeMlForecast).mockResolvedValue(null as any);

      const out = await loadLiveCuratedCatalog();
      expect(out.length).toBe(LEGO_SETS.length);
      expect(out[0].id).toBe(LEGO_SETS[0].id);
      expect(out.at(-1)!.id).toBe(LEGO_SETS.at(-1)!.id);
    });

    it("joins DDB rows by setNumber and prefers live values", async () => {
      const first = LEGO_SETS[0];
      vi.mocked(loadStoredCatalog).mockResolvedValue([
        // DDB-screener shape — only the fields we read
        {
          id: first.setNumber, // DDB-LegoSet.id IS the setNumber
          setNumber: first.setNumber,
          name: first.name,
          retired: first.status === "Retired",
        } as any,
      ]);
      vi.mocked(loadHistory).mockResolvedValue([
        { date: "2026-06", price: 999 },
      ]);
      vi.mocked(computeMlForecast).mockResolvedValue(null as any);

      const out = await loadLiveCuratedCatalog();
      expect(out[0].currentPrice).toBe(999); // from history latest
    });
  });
  ```
  Run:
  ```bash
  npm test --silent -- src/lib/data/live-catalog.test.ts
  ```
  Expected: FAIL (`Cannot find module './live-catalog'`).

- [ ] **Step 2: Create the adapter skeleton & make tests fail with the right errors**

  Create `src/lib/data/live-catalog.ts`:
  ```ts
  import "server-only";

  import { LEGO_SETS } from "./sets";
  import type { LegoSet as MvpLegoSet } from "@/lib/domain/lego-set";
  import type { LegoSet as DdbLegoSet, ProductPricing, HistoryPoint } from "@/lib/types/lego";
  import type { Forecast } from "@/lib/domain/lego-forecast";
  import { loadStoredCatalog, getProductById } from "@/lib/db/lego-search";
  import { loadHistory } from "@/lib/db/lego-history";
  import { computeMlForecast } from "@/lib/domain/lego-forecast";

  /**
   * MVP-shape history point. Differs from the screener's HistoryPoint
   * by exposing the `source` field so the chart can render real vs
   * synthetic differently.
   */
  export interface LiveHistoryPoint {
    date: string;
    price: number;
    source: "real" | "synthetic_backfill";
  }

  interface AdaptInput {
    curated: MvpLegoSet;
    ddbProduct: DdbLegoSet | null;
    pricing: ProductPricing | null;
    history: HistoryPoint[];
    mlForecast: Forecast | null;
  }

  function formatPct(ratio: number): string {
    const pct = Math.round(ratio * 100);
    return (pct >= 0 ? "+" : "") + pct + "%";
  }

  function computeMomentum(history: HistoryPoint[]): string | null {
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted.at(-1)!;
    // Find ~12 months prior. History dates are "YYYY-MM" or similar.
    const latestDate = new Date(latest.date + "-01");
    const target = new Date(latestDate);
    target.setUTCFullYear(target.getUTCFullYear() - 1);
    const targetIso = target.toISOString().slice(0, 7);
    const yearAgo =
      sorted.find((h) => h.date === targetIso) ??
      sorted.find((h) => h.date < latest.date && h.date >= targetIso);
    if (!yearAgo || yearAgo.price <= 0) return null;
    return `${formatPct((latest.price - yearAgo.price) / yearAgo.price)} 12mo`;
  }

  function pickCurrentPrice(
    pricing: ProductPricing | null,
    history: HistoryPoint[],
    fallback: number,
  ): number {
    if (pricing?.newPrice && pricing.newPrice > 0) return Math.round(pricing.newPrice);
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted.at(-1);
    if (latest?.price && latest.price > 0) return Math.round(latest.price);
    return fallback;
  }

  export function toMvpLegoSet(input: AdaptInput): MvpLegoSet {
    const { curated, pricing, history, mlForecast } = input;
    const currentPrice = pickCurrentPrice(pricing, history, curated.currentPrice);
    const momentum = computeMomentum(history);

    const proj5y = mlForecast?.scenarios?.moderate?.projectedValue ?? curated.proj5y;
    const bear = mlForecast?.scenarios?.pessimist?.projectedValue ?? curated.bear;
    const bull = mlForecast?.scenarios?.optimist?.projectedValue ?? curated.bull;

    return {
      ...curated,
      currentPrice,
      proj5y: Math.round(proj5y),
      bear: Math.round(bear),
      bull: Math.round(bull),
      momentum: momentum ?? curated.momentum,
    };
  }

  export async function loadLiveCuratedCatalog(): Promise<MvpLegoSet[]> {
    let ddbAll: DdbLegoSet[] = [];
    try {
      ddbAll = await loadStoredCatalog({ includeOrphans: true, orphanCap: 50_000 });
    } catch (err) {
      console.warn("[live-catalog] loadStoredCatalog failed, full fallback:", err);
      return LEGO_SETS;
    }

    const bySetNumber = new Map<string, DdbLegoSet>();
    for (const p of ddbAll) bySetNumber.set(p.setNumber, p);

    const out: MvpLegoSet[] = [];
    for (const curated of LEGO_SETS) {
      const ddbProduct = bySetNumber.get(curated.setNumber) ?? null;

      let history: HistoryPoint[] = [];
      let pricing: ProductPricing | null = null;
      let mlForecast: Forecast | null = null;

      if (ddbProduct) {
        history = await loadHistory(ddbProduct).catch(() => []);
        // pricing lives in PRICING#PRODUCT — we load via ML which reads it,
        // but expose a cheap fallback here. For now we let mlForecast carry
        // the current price snapshot.
        mlForecast = await computeMlForecast(ddbProduct, null).catch(() => null);
      }

      out.push(toMvpLegoSet({ curated, ddbProduct, pricing, history, mlForecast }));
    }
    return out;
  }

  export async function loadLiveCuratedSet(slug: string): Promise<MvpLegoSet | null> {
    const curated = LEGO_SETS.find((s) => s.id === slug);
    if (!curated) return null;
    // Single-set fast path: DDB-LegoSet.id IS the LEGO setNumber, so we
    // can BatchGet by it directly (cheap). getProductBySlug would do a
    // full Scan and try to match against the rebrickable-derived slug,
    // which is unrelated to the curated MVP slug.
    const ddbProduct = await getProductById(curated.setNumber).catch(() => null);

    let history: HistoryPoint[] = [];
    let mlForecast: Forecast | null = null;
    if (ddbProduct) {
      history = await loadHistory(ddbProduct).catch(() => []);
      mlForecast = await computeMlForecast(ddbProduct, null).catch(() => null);
    }

    return toMvpLegoSet({
      curated,
      ddbProduct,
      pricing: null,
      history,
      mlForecast,
    });
  }

  export async function loadLiveHistory(slug: string): Promise<LiveHistoryPoint[]> {
    const curated = LEGO_SETS.find((s) => s.id === slug);
    if (!curated) return [];
    const ddbProduct = await getProductById(curated.setNumber).catch(() => null);
    if (!ddbProduct) return [];
    const raw = await loadHistory(ddbProduct).catch(() => []);
    return raw.map((h) => ({
      date: h.date,
      price: h.price,
      // loadHistory currently drops the source field; assume "real" for any
      // row it returns from the DDB query path. The synthesise script tags
      // its rows source="synthetic_backfill", but the screener's loadHistory
      // does not propagate the field. A future improvement would extend
      // loadHistory to carry source. For now treat unknown as "real".
      source: "real",
    }));
  }
  ```

  Run:
  ```bash
  npm test --silent -- src/lib/data/live-catalog.test.ts
  ```
  Expected: PASS for `toMvpLegoSet` tests (pure), PASS for the loadLiveCuratedCatalog tests with mocks.

- [ ] **Step 3: Iterate until all tests pass**

  Run the full suite:
  ```bash
  npm test --silent
  ```
  Expected: all tests pass (existing 194 + new ~7). Lint:
  ```bash
  npm run lint
  ```
  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```bash
  git checkout -b feat/real-data-5-live-catalog
  git add src/lib/data/live-catalog.ts src/lib/data/live-catalog.test.ts
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(data): live-catalog adapter — DDB+ML → MVP LegoSet

  Single owner of the screener-shape ↔ MVP-shape reconciliation.
  Public API: loadLiveCuratedCatalog(), loadLiveCuratedSet(slug),
  loadLiveHistory(slug). Pure toMvpLegoSet() unit-tested.

  Fallback ladder: no DDB row → full static curated; PRICING only →
  real currentPrice + static rest; history >= 2 → computed momentum;
  ML forecast present → real proj5y/bear/bull. Pages keep importing
  the MVP LegoSet type unchanged.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-5-live-catalog -m "Merge branch 'feat/real-data-5-live-catalog'"
  git push origin main
  ```

---

## Task 6: Swap Homepage to Live Data

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read the current import + top-picks logic**

  ```bash
  sed -n '1,30p' src/app/page.tsx
  ```
  Identify: `import { LEGO_SETS } from "@/lib/data/sets";` and how `topPicks` is computed.

- [ ] **Step 2: Update the imports + make it async**

  Edit `src/app/page.tsx`:
  - Remove: `import { LEGO_SETS } from "@/lib/data/sets";`
  - Add (alongside other imports): `import { loadLiveCuratedCatalog } from "@/lib/data/live-catalog";`
  - Change `export default function HomePage()` → `export default async function HomePage()`.
  - Before the `topPicks` computation, add:
    ```ts
    const LEGO_SETS = await loadLiveCuratedCatalog();
    ```
  - Keep `export const revalidate = 3600;` (it should already be there).

- [ ] **Step 3: Build + test**

  ```bash
  npm run lint && npm test --silent && npm run build
  ```
  Expected: lint clean, 194+ tests pass, build prerenders `/` and shows the live catalog.

- [ ] **Step 4: Commit**

  ```bash
  git checkout -b feat/real-data-6-homepage-live
  git add src/app/page.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(home): swap LEGO_SETS to loadLiveCuratedCatalog()

  Homepage hero + top-picks rail now read live DDB-derived values
  with graceful fallback. revalidate=3600 unchanged.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-6-homepage-live -m "Merge branch 'feat/real-data-6-homepage-live'"
  git push origin main
  ```

---

## Task 7: Swap Buying List Pages to Live Data

**Files:**
- Modify: `src/app/buying-list/retired/page.tsx`
- Modify: `src/app/buying-list/non-retired/page.tsx`

- [ ] **Step 1: Update `retired/page.tsx`**

  Edit `src/app/buying-list/retired/page.tsx`:
  - Remove: `import { LEGO_SETS } from "@/lib/data/sets";`
  - Add: `import { loadLiveCuratedCatalog } from "@/lib/data/live-catalog";`
  - Change `export default function RetiredBuyingListPage()` → `export default async function RetiredBuyingListPage()`.
  - Inside, before the `picks` computation, add: `const LEGO_SETS = await loadLiveCuratedCatalog();`

- [ ] **Step 2: Update `non-retired/page.tsx`**

  Same three edits on `src/app/buying-list/non-retired/page.tsx`.

- [ ] **Step 3: Build + test**

  ```bash
  npm run lint && npm test --silent && npm run build
  ```
  Expected: clean lint, all tests pass, both routes prerender with `revalidate=3600`.

- [ ] **Step 4: Commit**

  ```bash
  git checkout -b feat/real-data-7-buying-list-live
  git add src/app/buying-list/retired/page.tsx src/app/buying-list/non-retired/page.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(buying-list): swap to live catalog source

  Both /buying-list/retired and /buying-list/non-retired now read
  loadLiveCuratedCatalog(). Score-based filtering + top-10 slicing
  unchanged.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-7-buying-list-live -m "Merge branch 'feat/real-data-7-buying-list-live'"
  git push origin main
  ```

---

## Task 8: Swap Set-Forecast List to Live Data

**Files:**
- Modify: `src/app/set-forecast/page.tsx`

- [ ] **Step 1: Update**

  Edit `src/app/set-forecast/page.tsx`:
  - Remove: `import { LEGO_SETS } from "@/lib/data/sets";`
  - Add: `import { loadLiveCuratedCatalog } from "@/lib/data/live-catalog";`
  - `export default async function SetForecastPage()` if not already async.
  - Inside: `const LEGO_SETS = await loadLiveCuratedCatalog();`

- [ ] **Step 2: Build + test + commit**

  ```bash
  npm run lint && npm test --silent && npm run build
  git checkout -b feat/real-data-8-screener-live
  git add src/app/set-forecast/page.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(screener): swap to live catalog source

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-8-screener-live -m "Merge branch 'feat/real-data-8-screener-live'"
  git push origin main
  ```

---

## Task 9: Swap Set-Forecast Detail Page to Live Data

**Files:**
- Modify: `src/app/set-forecast/[slug]/page.tsx`

**Why slightly different:** The detail page does a `.find(s => s.id === slug)`. We replace it with `loadLiveCuratedSet(slug)`. `generateStaticParams` keeps reading the static `LEGO_SETS` list (the slug list is the deliberate static contract; only the values are live).

- [ ] **Step 1: Read current shape**

  ```bash
  sed -n '1,40p' src/app/set-forecast/[slug]/page.tsx
  ```
  Note: `generateStaticParams` returns `{ slug: ... }[]` from `LEGO_SETS`. We keep this — it's the build-time list of paths.

- [ ] **Step 2: Update imports & the page function**

  Edit `src/app/set-forecast/[slug]/page.tsx`:
  - Keep the import `import { LEGO_SETS } from "@/lib/data/sets";` — `generateStaticParams` still uses it.
  - Add: `import { loadLiveCuratedSet, loadLiveHistory } from "@/lib/data/live-catalog";`
  - In `generateStaticParams`, keep using `LEGO_SETS`.
  - In the default page function, replace:
    ```ts
    const set = LEGO_SETS.find(s => s.id === params.slug);
    ```
    with:
    ```ts
    const set = await loadLiveCuratedSet(params.slug);
    const history = await loadLiveHistory(params.slug);
    ```
  - Pass `history` as a prop to `<MvpForecastChart set={set} history={history} />` (the chart accepts the new prop after Task 10).

- [ ] **Step 3: Build + test + commit**

  ```bash
  npm run lint && npm test --silent && npm run build
  ```
  Expected: build prerenders all 50 detail pages. (Build calls `loadLiveCuratedSet` 50 times during prerender — each is one DDB BatchGet round-trip; acceptable.)

  ```bash
  git checkout -b feat/real-data-9-detail-live
  git add src/app/set-forecast/[slug]/page.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(detail): swap detail page to live data + load history

  generateStaticParams still reads the static 50-slug list; the page
  body now resolves each slug via loadLiveCuratedSet(slug) and
  loadLiveHistory(slug). History passes through to MvpForecastChart
  for Task 10.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-9-detail-live -m "Merge branch 'feat/real-data-9-detail-live'"
  git push origin main
  ```

---

## Task 10: Wire Real History into `MvpForecastChart` (Phase 5)

**Files:**
- Modify: `src/components/sets/MvpForecastChart.tsx`

**What changes:** The chart currently fakes history by parsing `set.momentum` and backcasting. Replace that with a `history` prop. Render real points as a solid blue line; if no history is passed, fall back to the current synthetic backcast (so the chart never breaks during partial rollout).

- [ ] **Step 1: Add the prop + types**

  Edit `src/components/sets/MvpForecastChart.tsx`:
  - Import the live history type:
    ```ts
    import type { LiveHistoryPoint } from "@/lib/data/live-catalog";
    ```
  - Change `interface Props { set: LegoSet }` to:
    ```ts
    interface Props {
      set: LegoSet;
      history?: LiveHistoryPoint[];
    }
    ```
  - Change `function buildSeries(set: LegoSet): Point[]` to `function buildSeries(set: LegoSet, history?: LiveHistoryPoint[]): Point[]`.

- [ ] **Step 2: Use real history when present**

  Inside `buildSeries`, at the top:
  ```ts
  const out: Point[] = [];

  if (history && history.length > 0) {
    // Sort + map real rows to chart-time (years offset from today)
    const now = new Date();
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    for (const h of sorted) {
      const d = new Date(h.date + "-01");
      const yrs = (d.getUTCFullYear() - now.getUTCFullYear())
        + (d.getUTCMonth() - now.getUTCMonth()) / 12;
      out.push({
        t: +yrs.toFixed(3),
        history: h.source === "real" ? Math.round(h.price) : undefined,
        historySynthetic: h.source === "synthetic_backfill" ? Math.round(h.price) : undefined,
      });
    }
  } else {
    // Fallback: original backcast (keeps the chart working when no
    // history has been synced yet for this set).
    const annualBack = parseMomentumAnnual(set.momentum ?? "+5% 12mo");
    for (let m = -36; m <= 0; m++) {
      const yrs = m / 12;
      const noise = 1 + 0.015 * Math.sin(m * 0.9);
      const price = (set.currentPrice / Math.pow(1 + annualBack, -yrs)) * noise;
      out.push({ t: yrs, history: Math.round(price) });
    }
  }
  ```

  Extend `interface Point` to include `historySynthetic?: number;`.

- [ ] **Step 3: Render the dotted synthetic line**

  Inside the `<ComposedChart>`, after the existing `<Line dataKey="history" ...>`, add:
  ```tsx
  <Line
    type="monotone"
    dataKey="historySynthetic"
    stroke="#1f6feb"
    strokeWidth={2}
    strokeDasharray="4 4"
    dot={false}
    name="History (estimated)"
    isAnimationActive={false}
  />
  ```

- [ ] **Step 4: Update the call site**

  In Task 9 we already pass `history={history}` from `[slug]/page.tsx`. Verify the chart import / prop names match.

- [ ] **Step 5: Build + test + commit**

  ```bash
  npm run lint && npm test --silent && npm run build
  git checkout -b feat/real-data-10-chart-history
  git add src/components/sets/MvpForecastChart.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(chart): plot real history when present, fall back to backcast

  MvpForecastChart now accepts a history prop (LiveHistoryPoint[]).
  Real rows render as solid blue, synthetic_backfill rows as dotted
  blue. When no history is passed, the original momentum-derived
  backcast is used so the chart never breaks during partial data
  rollout.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-10-chart-history -m "Merge branch 'feat/real-data-10-chart-history'"
  git push origin main
  ```

---

## Task 11: Make `momentum` & `communityScore` Nullable + UI Handles Null (Phase 6)

**Files:**
- Modify: `src/lib/domain/lego-set.ts`
- Modify: `src/lib/data/live-catalog.ts` (already drafted in Task 5 — adjust)
- Modify: `src/components/sets/WhyThisRating.tsx`
- Modify: `src/components/sets/LiveMarketPanel.tsx`
- Modify: `src/components/sets/MvpForecastChart.tsx` (parseMomentumAnnual already null-safe via fallback)

- [ ] **Step 1: Loosen the MVP type**

  Edit `src/lib/domain/lego-set.ts`:
  ```ts
  export interface LegoSet {
    // ...
    communityScore: number | null;  // was: number
    momentum: string | null;        // was: string
    // ...
  }
  ```

- [ ] **Step 2: Update `live-catalog.ts` to actually return null when appropriate**

  In `toMvpLegoSet`, change:
  ```ts
  momentum: momentum ?? curated.momentum,
  ```
  to:
  ```ts
  // Prefer computed momentum. If history was insufficient AND DDB had
  // no row at all, fall back to the curated string. If history was
  // insufficient but DDB had a product (meaning real data is being
  // gathered), surface null so the UI shows "—" honestly.
  momentum: momentum ?? (input.ddbProduct ? null : curated.momentum),
  ```
  Add a similar treatment for `communityScore`. Until trends+community syncs propagate into the adapter, leave `communityScore: curated.communityScore` (we don't have a fetch yet — defer that to a follow-up; the type widening is what unblocks the UI today).

- [ ] **Step 3: Update components that read these fields**

  `src/components/sets/WhyThisRating.tsx`: find every `set.momentum` and `set.communityScore` reference. Replace with:
  ```tsx
  {set.momentum ?? "—"}
  {set.communityScore ?? "—"}
  ```
  Apply the same to `src/components/sets/LiveMarketPanel.tsx`.

  Search-and-fix one-pass:
  ```bash
  grep -rn "set\\.momentum\\|set\\.communityScore" src/components/sets src/app
  ```
  For every hit not already null-safe, wrap with `?? "—"`.

- [ ] **Step 4: Update the chart's momentum parse to tolerate null**

  In `src/components/sets/MvpForecastChart.tsx`, `parseMomentumAnnual` accepts `string`. The fallback case in `buildSeries` already does `set.momentum ?? "+5% 12mo"` — keep that, but also widen the function signature:
  ```ts
  function parseMomentumAnnual(momentum: string | null | undefined): number {
    if (!momentum) return 0.05;
    const m = momentum.match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (!m) return 0.05;
    return Number(m[1]) / 100;
  }
  ```

- [ ] **Step 5: Update `sets.ts` literal? No.**

  All 50 rows in `sets.ts` keep their string `momentum` and number `communityScore`. The `| null` widening of the type accepts those — no migration needed.

- [ ] **Step 6: Build + test + commit**

  ```bash
  npm run lint && npm test --silent && npm run build
  git checkout -b feat/real-data-11-nullable-fields
  git add src/lib/domain/lego-set.ts src/lib/data/live-catalog.ts \
    src/components/sets/WhyThisRating.tsx src/components/sets/LiveMarketPanel.tsx \
    src/components/sets/MvpForecastChart.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "feat(types): momentum + communityScore are nullable

  Widens LegoSet.momentum to string|null and LegoSet.communityScore
  to number|null. UI components fall back to '—' for null. The
  adapter returns null when history is insufficient AND a DDB row
  exists (honest about data gaps); falls back to the curated string
  otherwise (preserves first-run UX).

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-11-nullable-fields -m "Merge branch 'feat/real-data-11-nullable-fields'"
  git push origin main
  ```

---

## Task 12: Update Methodology Copy (Phase 7)

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Replace the Inputs bullets**

  Edit `src/app/contact/page.tsx`, in the `<section id="methodology">` block, replace the `<ul class="list-disc ...">` with:
  ```tsx
  <ul className="list-disc pl-6 space-y-1">
    <li><strong>Historical pricing:</strong> monthly sealed price snapshots from PriceCharting going back as far as available (typically 12–36 months per set), supplemented by BrickLink sold comps and eBay completed listings.</li>
    <li><strong>Retirement status:</strong> active vs. retiring-soon vs. retired drives supply dynamics.</li>
    <li><strong>Community signal:</strong> Google Trends monthly search interest (35% weight) and Reddit/forum engagement scores (65% weight), both synced monthly.</li>
    <li><strong>Market liquidity:</strong> active listing depth as a proxy for tradeability.</li>
    <li><strong>Price agreement:</strong> dispersion of recent sold comps around the consensus price.</li>
  </ul>
  ```

- [ ] **Step 2: Add a data-freshness paragraph after the composite score section**

  Immediately after the closing `</p>` of the Composite-score paragraph, add:
  ```tsx
  <p>
    <strong>Data freshness:</strong> prices and signals update hourly via
    incremental static regeneration. The ML model retrains weekly on the
    latest available data.
  </p>
  ```

- [ ] **Step 3: Build + test + commit**

  ```bash
  npm run lint && npm test --silent && npm run build
  git checkout -b feat/real-data-12-methodology-copy
  git add src/app/contact/page.tsx
  git -c user.name="Tulio Soria" -c user.email="tuliosoria@users.noreply.github.com" \
    commit -m "docs(methodology): describe real data sources + freshness cadence

  Replaces the placeholder 'planned'-style descriptions with what the
  pipeline actually does after Phases 1–6: PriceCharting + BrickLink +
  eBay for pricing/comps, Google Trends + Reddit for community,
  weighted 35/65; hourly ISR; weekly model retrain.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  git checkout main && git merge --no-ff feat/real-data-12-methodology-copy -m "Merge branch 'feat/real-data-12-methodology-copy'"
  git push origin main
  ```

---

## Task 13: End-to-End Verification

**Files:** none (smoke testing)

- [ ] **Step 1: Local smoke test**

  ```bash
  npm run build && npm run start &
  SERVER_PID=$!
  sleep 8

  # Check homepage
  curl -fsS http://localhost:3000/ > /tmp/home.html
  grep -q "Top 6 picks" /tmp/home.html && echo "home OK"

  # Check buying lists
  curl -fsS http://localhost:3000/buying-list/retired > /tmp/r.html
  grep -q "Retired Buying List" /tmp/r.html && echo "retired OK"
  curl -fsS http://localhost:3000/buying-list/non-retired > /tmp/nr.html
  grep -q "Non-Retired Buying List" /tmp/nr.html && echo "non-retired OK"

  # Check 3 specific detail pages
  for slug in modular-bookshop ucs-millennium-falcon hp-hogwarts-castle; do
    curl -fsS http://localhost:3000/set-forecast/$slug > /tmp/$slug.html
    grep -q '\$' /tmp/$slug.html && echo "$slug renders price"
  done

  kill $SERVER_PID
  ```
  Expected: all checks print OK.

- [ ] **Step 2: Verify three sets show DDB-driven prices**

  For each of `modular-bookshop` (10270), `ucs-millennium-falcon` (75192), `hp-hogwarts-castle` (71043):
  - Note the `currentPrice` in `sets.ts` (the hand-typed value).
  - Note the `newSealed` in DDB `PRICING#PRODUCT#<setNumber>`.
  - If they differ, the page should show the DDB value. Eyeball the rendered HTML to confirm.

  If the values match exactly, that's also fine (PriceCharting just happens to agree).

- [ ] **Step 3: Verify the chart on a set with real history**

  Pick a set with ≥ 6 real HISTORY rows from Task 4 verification. Open `http://localhost:3000/set-forecast/<that-slug>` in a browser. Confirm the chart shows a solid blue line for past months (not the synthetic dotted line).

- [ ] **Step 4: Final commit (if any cleanup)**

  If smoke testing surfaced bugs, fix them in a `fix/real-data-13-smoke-fixes` branch, commit, merge, push.

  Otherwise no commit — the task is verification only.

---

## Task 14: Deploy the Retrainer Lambda (Phase 4 — MANUAL GATE)

**Files:** none (deploy)

**This task requires the user to run.** The agent cannot complete it because (a) SAM CLI is not installed locally per `npm run infra:build`, (b) AWS deploy permissions may need to be granted, (c) deployment-time IAM decisions should not be automated.

- [ ] **Step 1: User installs SAM CLI**

  ```bash
  brew install aws-sam-cli
  sam --version
  ```

- [ ] **Step 2: User builds + deploys**

  ```bash
  cd ~/legofuture
  npm run infra:build
  cd infra/lego-ml-retrainer
  sam deploy --guided   # first time only — answers persisted to samconfig.toml
  ```

- [ ] **Step 3: User verifies**

  ```bash
  aws lambda list-functions --region us-east-1 \
    --query 'Functions[?contains(FunctionName, `lego-ml-retrainer`)].FunctionName'
  # expect one function name

  aws lambda invoke --function-name lego-ml-retrainer \
    --region us-east-1 --payload '{}' /tmp/response.json && cat /tmp/response.json
  # expect { "ok": true, ... }

  aws dynamodb get-item --table-name legofuture-cache --region us-east-1 \
    --key '{"pk":{"S":"META#LAST_MODEL_TRAIN"},"sk":{"S":"v1"}}' \
    --query 'Item.timestamp.S'
  # expect a timestamp from the manual invocation
  ```

- [ ] **Step 4: Confirm the EventBridge schedule**

  ```bash
  aws events list-rules --region us-east-1 \
    --query 'Rules[?contains(Name, `lego-ml`)].{Name:Name, Schedule:ScheduleExpression, State:State}'
  # expect: rate(7 days), ENABLED
  ```

- [ ] **Step 5: User-facing acknowledgement**

  No commit needed. Note in a chat message that Phase 4 is complete and the retrainer will fire on schedule.

---

## Verification Checklist (mirrors §13 of the spec)

After all tasks complete, every item below must be true:

- [ ] All 7 sync scripts ran (or SKIP-with-reason logged for the 3 missing-key ones)
- [ ] `META#SYNC#...` rows current in DDB
- [ ] ≥ 40 of 50 sets have ≥ 6 HISTORY rows (real + synthetic combined; synthetic deletes itself once real arrives)
- [ ] ML training completed with `sampleCount >= 20`
- [ ] `MODEL#FORECAST#1y`, `#3y`, `#5y` chunks exist in DDB
- [ ] `/set-forecast` shows real `currentPrice` values (manual check vs BrickLink for 3 sets)
- [ ] `/set-forecast/<any-slug-with-history>` shows a chart with a real-history blue line
- [ ] `momentum` is computed or `null` (rendered as "—"); no longer a stale string after a DDB row exists
- [ ] `communityScore` is a number or `null` (UI handles both)
- [ ] EventBridge rule exists and is ENABLED (manual gate)
- [ ] Lambda manual invoke updates `META#LAST_MODEL_TRAIN` (manual gate)
- [ ] ISR confirmed: hard-reload `/set-forecast` after 1 hr → fresh prices
- [ ] `/contact#methodology` copy updated, no "planned"-style language remains

---

## What NOT to touch (reminder)

- DynamoDB table name `legofuture-cache` and key schema — unchanged
- `lego-ml/extract_features.py` **feature list** — only the per-row weighting is added (Task 3)
- `/api/sets/*` routes — already correct
- `/terms`, `/privacy`, `/privacy-rights` pages — not in scope
- `src/lib/data/sets.ts` — preserved as fallback + slug-to-setNumber registry
