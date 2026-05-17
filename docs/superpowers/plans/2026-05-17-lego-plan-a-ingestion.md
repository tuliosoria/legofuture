# LegoFuture Plan A — Multi-Source Ingestion + Full-Catalog Runtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand LegoFuture from 20 curated sets to virtually all LEGO sets (~5K with pricing data, ~20K total via Rebrickable spine) and refactor the runtime to render the full catalog from DDB with a "show all" toggle for orphan sets.

**Architecture:** Six sync scripts (one per data source) write to a unified DDB keyspace. A new key-constants module guarantees writers and reader agree. The Next.js runtime reads the full `CATALOG#PRODUCT#*` partition (instead of the bundled JSON) and applies eligibility filtering (`pricingProviderCount >= 1`) before display.

**Tech Stack:** Node 22 (.mjs scripts), TypeScript 6, Next 16 (App Router), `@aws-sdk/lib-dynamodb`, vitest, OAuth 1.0a (BrickLink, via `oauth-1.0a` npm package).

**Scope:** Phase 1 of the multisource-lego-ml-forecast-design spec. Plans B (training) and C (CI + drift) follow.

**Key separation:** 3 sub-pipelines need API keys not yet in `.env.local`. Tagged `[BLOCKED-ON-KEYS]`. They are still fully specified so they ship as code now and execute the moment the keys land.

See `docs/superpowers/specs/2026-05-17-multisource-lego-ml-forecast-design.md` for full design context, including Plans B/C.

---

## File Structure

| File | Purpose | Status |
|---|---|---|
| `src/lib/db/lego-keys.ts` | DDB key prefix + builder constants | NEW |
| `src/lib/db/lego-search.ts` | Catalog reader; switch to full-keyspace scan | MODIFY |
| `src/lib/types/lego.ts` | Add `enrichmentStatus`, `pricingProviderCount` fields | MODIFY |
| `src/lib/domain/lego-catalog-eligibility.ts` | Eligibility predicate (≥1 pricing source) | NEW |
| `src/components/sets/forecast-dashboard.tsx` | "Show all sets" toggle | MODIFY |
| `scripts/sync-pricecharting-to-dynamo.mjs` | Replace `?platform=lego` with `?q=lego` + filter | MODIFY |
| `scripts/sync-rebrickable-catalog.mjs` | Catalog spine | NEW (key-gated) |
| `scripts/sync-brickset-enrichment.mjs` | Regional RRP enrichment | NEW (key-gated) |
| `scripts/sync-bricklink-pricing.mjs` | Primary historical pricing | NEW (key-gated) |
| `scripts/sync-ebay-sold-listings.mjs` | Sold listings aggregator | NEW (key-gated) |
| `scripts/sync-all.sh` | Orchestrator — gracefully skip key-less scripts | MODIFY |
| `scripts/smoke-test-sync.mjs` | E2E smoke: 50 random sets → complete row coverage | NEW |
| `package.json` | Add npm scripts for new syncs | MODIFY |
| `tests/lib/db/lego-keys.test.ts` | Key builders | NEW |
| `tests/lib/db/lego-search.test.ts` | Full-catalog read + filter | NEW |
| `tests/lib/domain/lego-catalog-eligibility.test.ts` | Predicate | NEW |

---

## Tasks

### Task 1: DDB key constants module

**Files:**
- Create: `src/lib/db/lego-keys.ts`
- Test: `tests/lib/db/lego-keys.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { catalogPk, pricingPk, historyPk, historySk, modelChunkSk, syncMetaPk } from "@/lib/db/lego-keys";

describe("lego-keys", () => {
  it("builds CATALOG pk", () => {
    expect(catalogPk("75192")).toBe("CATALOG#PRODUCT#75192");
  });
  it("builds PRICING pk", () => {
    expect(pricingPk("75192")).toBe("PRICING#PRODUCT#75192");
  });
  it("builds HISTORY pk + monthly sk", () => {
    expect(historyPk("75192")).toBe("HISTORY#PRODUCT#75192");
    expect(historySk("bricklink-new", new Date("2026-03-15T00:00:00Z"))).toBe("bricklink-new#2026-03");
  });
  it("builds MODEL chunk sk", () => {
    expect(modelChunkSk("3yr", 7)).toBe("FORECAST#3yr#chunk#0007");
  });
  it("builds SYNC meta pk", () => {
    expect(syncMetaPk("rebrickable", "2026-05-17T03:00:00Z")).toBe("META#SYNC#rebrickable#2026-05-17T03:00:00Z");
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/lib/db/lego-keys.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/db/lego-keys.ts
export const CATALOG_PK_PREFIX = "CATALOG#PRODUCT#";
export const PRICING_PK_PREFIX = "PRICING#PRODUCT#";
export const HISTORY_PK_PREFIX = "HISTORY#PRODUCT#";
export const COMMUNITY_PK_PREFIX = "COMMUNITY#PRODUCT#";
export const MODEL_PK_PREFIX = "MODEL#";
export const SYNC_META_PK_PREFIX = "META#SYNC#";

export type HistorySource =
  | "bricklink-new"
  | "bricklink-used"
  | "pricecharting-loose"
  | "pricecharting-cib"
  | "pricecharting-new"
  | "pricecharting-snapshot"
  | "ebay";

export type ForecastHorizon = "1yr" | "3yr" | "5yr";

export const catalogPk = (setNum: string) => `${CATALOG_PK_PREFIX}${setNum}`;
export const pricingPk = (setNum: string) => `${PRICING_PK_PREFIX}${setNum}`;
export const historyPk = (setNum: string) => `${HISTORY_PK_PREFIX}${setNum}`;
export const communityPk = (setNum: string) => `${COMMUNITY_PK_PREFIX}${setNum}`;

export function historySk(source: HistorySource, date: Date): string {
  return `${source}#${date.toISOString().slice(0, 7)}`;
}

export function modelChunkSk(horizon: ForecastHorizon, chunkIndex: number): string {
  return `FORECAST#${horizon}#chunk#${String(chunkIndex).padStart(4, "0")}`;
}

export function syncMetaPk(source: string, isoTs: string): string {
  return `${SYNC_META_PK_PREFIX}${source}#${isoTs}`;
}
```

- [ ] **Step 4: Run, expect PASS (5 tests)**

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/lego-keys.ts tests/lib/db/lego-keys.test.ts
git commit -m "feat(db): add lego-keys constants module

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Eligibility predicate

**Files:**
- Create: `src/lib/domain/lego-catalog-eligibility.ts`
- Test: `tests/lib/domain/lego-catalog-eligibility.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { isEligibleForDashboard, countPricingProviders } from "@/lib/domain/lego-catalog-eligibility";

describe("countPricingProviders", () => {
  it("counts non-null pricing sources", () => {
    expect(countPricingProviders({ pricecharting: { current: 100 } })).toBe(1);
    expect(countPricingProviders({ pricecharting: { current: 100 }, bricklink: { newAvg: 95 } })).toBe(2);
    expect(countPricingProviders({})).toBe(0);
    expect(countPricingProviders({ pricecharting: null })).toBe(0);
  });
});

describe("isEligibleForDashboard", () => {
  it("eligible when ≥1 pricing source", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 1 })).toBe(true);
    expect(isEligibleForDashboard({ pricingProviderCount: 3 })).toBe(true);
  });
  it("ineligible when zero pricing sources", () => {
    expect(isEligibleForDashboard({ pricingProviderCount: 0 })).toBe(false);
    expect(isEligibleForDashboard({})).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/lib/domain/lego-catalog-eligibility.ts
export interface PricingProviders {
  pricecharting?: { current?: number | null } | null;
  bricklink?: { newAvg?: number | null; usedAvg?: number | null } | null;
  ebay?: { medianSoldUsd?: number | null } | null;
  brickset?: { launchPriceUsd?: number | null } | null;
}

export function countPricingProviders(p: PricingProviders | null | undefined): number {
  if (!p) return 0;
  let n = 0;
  if (p.pricecharting && typeof p.pricecharting.current === "number") n++;
  if (p.bricklink && (typeof p.bricklink.newAvg === "number" || typeof p.bricklink.usedAvg === "number")) n++;
  if (p.ebay && typeof p.ebay.medianSoldUsd === "number") n++;
  if (p.brickset && typeof p.brickset.launchPriceUsd === "number") n++;
  return n;
}

export interface EligibilityInput { pricingProviderCount?: number }
export function isEligibleForDashboard(item: EligibilityInput): boolean {
  return (item.pricingProviderCount ?? 0) >= 1;
}
```

- [ ] **Step 4: Run, expect PASS (6 tests)**

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/lego-catalog-eligibility.ts tests/lib/domain/lego-catalog-eligibility.test.ts
git commit -m "feat(domain): eligibility predicate gates orphan sets from default dashboard

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Type augmentation for `LegoSet`

**Files:** Modify `src/lib/types/lego.ts`

- [ ] **Step 1: Add fields**

Locate the `LegoSet` interface. Add:

```ts
export type EnrichmentStatus =
  | "rebrickable-only"
  | "pricecharting-only"
  | "fully-enriched"
  | "legacy-curated";

// Inside LegoSet interface:
//   enrichmentStatus?: EnrichmentStatus;
//   pricingProviderCount?: number;
```

- [ ] **Step 2: Run `npx tsc --noEmit` — expect PASS**

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/lego.ts
git commit -m "feat(types): add enrichmentStatus + pricingProviderCount on LegoSet

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Fix PriceCharting sync

**Files:** Modify `scripts/sync-pricecharting-to-dynamo.mjs`

PriceCharting's `?platform=lego` returns 0 products. Correct: `?q=lego` paginated, filter `console-name LIKE "LEGO %"`, drop `LEGO Games` (video games).

- [ ] **Step 1: Replace `fetchPage`** (current around line 60):

```js
async function fetchPage(offset) {
  const url = `${ENDPOINT}?q=lego&t=${TOKEN}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} at offset=${offset}`);
  const data = await res.json();
  if (data.status && data.status !== "success") {
    throw new Error(`API error at offset=${offset}: ${data["error-message"] || data.status}`);
  }
  const all = Array.isArray(data.products) ? data.products : [];
  return all.filter((p) => {
    const consoleName = String(p["console-name"] || "");
    if (!consoleName.startsWith("LEGO ")) return false;
    if (consoleName === "LEGO Games") return false;
    return true;
  });
}
```

- [ ] **Step 2: Update pagination stop**

Find the main loop. Old stop = first empty page. Replace with 3-consecutive-empty streak (we now filter client-side):

```js
let consecutiveEmpty = 0;
const MAX_EMPTY_STREAK = 3;
// inside the loop, after fetchPage:
if (products.length === 0) {
  consecutiveEmpty++;
  if (consecutiveEmpty >= MAX_EMPTY_STREAK) break;
} else {
  consecutiveEmpty = 0;
}
```

- [ ] **Step 3: Tag CATALOG writes with enrichment + provider count**

Where the CATALOG item is built, add:

```js
const catalogItem = {
  // ...existing fields...
  enrichmentStatus: "pricecharting-only",
  pricingProviderCount: 1,
  updatedAt: nowIso,
};
```

- [ ] **Step 4: Smoke run**

Run: `npm run sync:pricecharting` (kill after ~60 s if no `--max-pages` flag exists). Expect log lines like `[pc-sync] page 0 → fetched 200, kept 23 LEGO`. Non-zero kept-count = success.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-pricecharting-to-dynamo.mjs
git commit -m "fix(sync): PriceCharting uses q=lego + filter (platform=lego returns empty)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Rebrickable catalog spine sync `[BLOCKED-ON-KEYS: REBRICKABLE_API_KEY]`

**Files:** Create `scripts/sync-rebrickable-catalog.mjs`

- [ ] **Step 1: Create script**

```js
#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const KEY = process.env.REBRICKABLE_API_KEY;
const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const BASE = "https://rebrickable.com/api/v3/lego";
const CACHE_DIR = ".cache/rebrickable";
const PAGE_SIZE = 1000;

if (!KEY) { console.error("[rb-sync] FATAL: REBRICKABLE_API_KEY required"); process.exit(1); }

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rbFetch(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}key=${KEY}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`Rate-limited after 3 retries: ${path}`);
}

async function loadThemes() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = `${CACHE_DIR}/themes.json`;
  if (existsSync(cachePath)) return JSON.parse(await readFile(cachePath, "utf8"));
  const out = {};
  let url = `/themes/?page_size=${PAGE_SIZE}`;
  while (url) {
    const data = await rbFetch(url);
    for (const t of data.results) out[t.id] = { name: t.name, parent_id: t.parent_id };
    url = data.next ? data.next.replace(/^.*\/api\/v3\/lego/, "").replace(/&?key=[^&]+/, "") : null;
  }
  await writeFile(cachePath, JSON.stringify(out, null, 2));
  return out;
}

async function* paginateSets() {
  let url = `/sets/?page_size=${PAGE_SIZE}&ordering=set_num`;
  while (url) {
    const data = await rbFetch(url);
    for (const s of data.results) yield s;
    url = data.next ? data.next.replace(/^.*\/api\/v3\/lego/, "").replace(/&?key=[^&]+/, "") : null;
  }
}

async function batchWriteAll(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })) },
    }));
  }
}

async function main() {
  console.log("[rb-sync] loading themes…");
  const themes = await loadThemes();
  console.log(`[rb-sync] ${Object.keys(themes).length} themes`);

  const nowIso = new Date().toISOString();
  let count = 0;
  let buffer = [];

  for await (const s of paginateSets()) {
    const theme = themes[s.theme_id] || { name: "Unknown" };
    buffer.push({
      pk: `CATALOG#PRODUCT#${s.set_num}`,
      sk: "v1",
      id: s.set_num,
      name: s.name,
      year: s.year,
      themeId: s.theme_id,
      themeName: theme.name,
      pieceCount: s.num_parts,
      imageUrl: s.set_img_url,
      rebrickableUrl: s.set_url,
      enrichmentStatus: "rebrickable-only",
      pricingProviderCount: 0,
      source: "rebrickable",
      updatedAt: nowIso,
    });
    count++;
    if (buffer.length >= 100) {
      await batchWriteAll(buffer);
      buffer = [];
      if (count % 1000 === 0) console.log(`[rb-sync] ${count} sets written`);
    }
  }
  if (buffer.length) await batchWriteAll(buffer);
  console.log(`[rb-sync] complete: ${count} sets`);

  await ddb.send(new BatchWriteCommand({
    RequestItems: {
      [TABLE]: [{
        PutRequest: {
          Item: {
            pk: `META#SYNC#rebrickable#${nowIso}`,
            sk: "v1",
            source: "rebrickable",
            totalProductsSynced: count,
            startedAt: nowIso,
            finishedAt: new Date().toISOString(),
          },
        },
      }],
    },
  }));
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add npm script**

In `package.json` `scripts`:
```json
"sync:rebrickable": "node --env-file=.env.local scripts/sync-rebrickable-catalog.mjs",
```

- [ ] **Step 3: Smoke run (if key available)** — `npm run sync:rebrickable`. Expect ~20K CATALOG rows in ~5 min.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-rebrickable-catalog.mjs package.json
git commit -m "feat(sync): Rebrickable catalog spine ingest (~20K LEGO sets)

Blocked on REBRICKABLE_API_KEY env var.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: BrickLink Price Guide sync `[BLOCKED-ON-KEYS]`

**Files:** Create `scripts/sync-bricklink-pricing.mjs`

**Required env:** `BRICKLINK_CONSUMER_KEY`, `BRICKLINK_CONSUMER_SECRET`, `BRICKLINK_TOKEN_VALUE`, `BRICKLINK_TOKEN_SECRET`.

- [ ] **Step 1: Install dependency** — `npm install --save oauth-1.0a`

- [ ] **Step 2: Create script**

```js
#!/usr/bin/env node
import crypto from "node:crypto";
import OAuth from "oauth-1.0a";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["BRICKLINK_CONSUMER_KEY","BRICKLINK_CONSUMER_SECRET","BRICKLINK_TOKEN_VALUE","BRICKLINK_TOKEN_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[bl-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const oauth = OAuth({
  consumer: { key: process.env.BRICKLINK_CONSUMER_KEY, secret: process.env.BRICKLINK_CONSUMER_SECRET },
  signature_method: "HMAC-SHA1",
  hash_function(base, key) { return crypto.createHmac("sha1", key).update(base).digest("base64"); },
});
const token = { key: process.env.BRICKLINK_TOKEN_VALUE, secret: process.env.BRICKLINK_TOKEN_SECRET };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function blFetch(url) {
  const req = { url, method: "GET" };
  const auth = oauth.toHeader(oauth.authorize(req, token));
  const res = await fetch(url, { headers: { ...auth, Accept: "application/json" } });
  if (res.status === 429) { await sleep(3000); return blFetch(url); }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();
  if (json.meta && json.meta.code >= 400) throw new Error(`BL API ${json.meta.code}: ${json.meta.message}`);
  return json.data;
}

async function loadAllSetNums() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item.id);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function fetchPriceGuide(setNum, condition) {
  const url = `https://api.bricklink.com/api/store/v1/items/SET/${setNum}-1/price?guide_type=sold&new_or_used=${condition}`;
  return blFetch(url);
}

async function syncOne(setNum) {
  const nowIso = new Date().toISOString();
  const yyyyMm = nowIso.slice(0, 7);
  const items = [];
  for (const cond of ["N", "U"]) {
    const guide = await fetchPriceGuide(setNum, cond).catch((e) => { console.warn(`[bl-sync] ${setNum} ${cond}: ${e.message}`); return null; });
    if (!guide) continue;
    const condLabel = cond === "N" ? "new" : "used";
    items.push({
      pk: `HISTORY#PRODUCT#${setNum}`,
      sk: `bricklink-${condLabel}#${yyyyMm}`,
      source: `bricklink-${condLabel}`,
      avgPrice: Number(guide.avg_price) || null,
      minPrice: Number(guide.min_price) || null,
      maxPrice: Number(guide.max_price) || null,
      qtyAvgPrice: Number(guide.qty_avg_price) || null,
      unitQuantity: guide.unit_quantity ?? null,
      totalQuantity: guide.total_quantity ?? null,
      capturedAt: nowIso,
    });
  }
  if (items.length) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: items.map((Item) => ({ PutRequest: { Item } })) } }));
  }
  const newItem = items.find((i) => i.source === "bricklink-new");
  const usedItem = items.find((i) => i.source === "bricklink-used");
  if (newItem || usedItem) {
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: [{ PutRequest: { Item: {
        pk: `PRICING#PRODUCT#${setNum}`,
        sk: "bricklink",
        newAvg: newItem?.avgPrice ?? null,
        usedAvg: usedItem?.avgPrice ?? null,
        capturedAt: nowIso,
      } } }] },
    }));
  }
}

async function main() {
  const setNums = await loadAllSetNums();
  console.log(`[bl-sync] ${setNums.length} sets to refresh`);
  let i = 0;
  for (const setNum of setNums) {
    await syncOne(setNum);
    i++;
    if (i % 100 === 0) console.log(`[bl-sync] ${i}/${setNums.length}`);
    await sleep(200);
  }
  console.log(`[bl-sync] done: ${i} sets refreshed`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Add npm script + commit**

```json
"sync:bricklink": "node --env-file=.env.local scripts/sync-bricklink-pricing.mjs",
```

```bash
git add scripts/sync-bricklink-pricing.mjs package.json package-lock.json
git commit -m "feat(sync): BrickLink Price Guide API ingestion (primary history source)

Blocked on BRICKLINK_CONSUMER_KEY/SECRET + TOKEN_VALUE/SECRET env vars.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Brickset enrichment sync `[BLOCKED-ON-KEYS]`

**Files:** Create `scripts/sync-brickset-enrichment.mjs`

**Required env:** `BRICKSET_API_KEY`, `BRICKSET_USERNAME`, `BRICKSET_PASSWORD`.

- [ ] **Step 1: Create script**

```js
#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["BRICKSET_API_KEY", "BRICKSET_USERNAME", "BRICKSET_PASSWORD"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[bs-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const BASE = "https://brickset.com/api/v3.asmx";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bsLogin() {
  const url = `${BASE}/login?apiKey=${process.env.BRICKSET_API_KEY}&username=${encodeURIComponent(process.env.BRICKSET_USERNAME)}&password=${encodeURIComponent(process.env.BRICKSET_PASSWORD)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "success") throw new Error(`Brickset login failed: ${data.message}`);
  return data.hash;
}

async function getSet(userHash, setNum) {
  const params = JSON.stringify({ setNumber: setNum });
  const url = `${BASE}/getSets?apiKey=${process.env.BRICKSET_API_KEY}&userHash=${userHash}&params=${encodeURIComponent(params)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.sets?.[0] || null;
}

async function loadAllSetNums() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item.id);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  const userHash = await bsLogin();
  const setNums = await loadAllSetNums();
  console.log(`[bs-sync] ${setNums.length} sets to enrich`);
  const nowIso = new Date().toISOString();
  let i = 0;
  for (const setNum of setNums) {
    const bs = await getSet(userHash, `${setNum}-1`).catch((e) => { console.warn(`[bs-sync] ${setNum}: ${e.message}`); return null; });
    if (bs) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: [{ PutRequest: { Item: {
          pk: `CATALOG#PRODUCT#${setNum}`,
          sk: "brickset",
          launchPriceUsd: bs.LEGOCom?.US?.retailPrice ?? null,
          launchPriceGbp: bs.LEGOCom?.UK?.retailPrice ?? null,
          launchPriceEur: bs.LEGOCom?.DE?.retailPrice ?? null,
          ageMin: bs.ageRange?.min ?? null,
          ageMax: bs.ageRange?.max ?? null,
          packagingType: bs.packagingType ?? null,
          dimensions: bs.dimensions ?? null,
          source: "brickset",
          updatedAt: nowIso,
        } } }] },
      }));
    }
    i++;
    if (i % 100 === 0) console.log(`[bs-sync] ${i}/${setNums.length}`);
    await sleep(1000);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add npm script + commit**

```json
"sync:brickset": "node --env-file=.env.local scripts/sync-brickset-enrichment.mjs",
```

```bash
git add scripts/sync-brickset-enrichment.mjs package.json
git commit -m "feat(sync): Brickset enrichment (launch prices, dimensions, age range)

Blocked on BRICKSET_API_KEY + USERNAME + PASSWORD env vars.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: eBay sold listings sync `[BLOCKED-ON-KEYS]`

**Files:** Create `scripts/sync-ebay-sold-listings.mjs`

**Required env:** `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`.

- [ ] **Step 1: Create script**

```js
#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REQUIRED = ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"];
for (const k of REQUIRED) if (!process.env[k]) { console.error(`[ebay-sync] FATAL: ${k} required`); process.exit(1); }

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken() {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) throw new Error(`eBay token HTTP ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function searchSold(token, setNum) {
  // Note: Browse API returns ACTIVE listings, not sold. True sold data needs
  // Marketplace Insights API approval. Using Browse as approximation.
  const q = encodeURIComponent(`LEGO ${setNum}`);
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&limit=50&filter=buyingOptions:{FIXED_PRICE}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) { await sleep(2000); return searchSold(token, setNum); }
  if (!res.ok) return null;
  const data = await res.json();
  const prices = (data.itemSummaries || [])
    .map((i) => Number(i.price?.value))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  return {
    medianPrice: prices[Math.floor(prices.length / 2)],
    count: prices.length,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
  };
}

async function loadAllSetNums() {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id",
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) out.push(item.id);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

async function main() {
  const token = await getAccessToken();
  const setNums = await loadAllSetNums();
  console.log(`[ebay-sync] ${setNums.length} sets to query`);
  const nowIso = new Date().toISOString();
  const yyyyMm = nowIso.slice(0, 7);
  let i = 0;
  for (const setNum of setNums) {
    const agg = await searchSold(token, setNum);
    if (agg) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: { [TABLE]: [{ PutRequest: { Item: {
          pk: `HISTORY#PRODUCT#${setNum}`,
          sk: `ebay#${yyyyMm}`,
          source: "ebay",
          medianPrice: agg.medianPrice,
          minPrice: agg.minPrice,
          maxPrice: agg.maxPrice,
          count: agg.count,
          capturedAt: nowIso,
        } } }] },
      }));
    }
    i++;
    if (i % 100 === 0) console.log(`[ebay-sync] ${i}/${setNums.length}`);
    await sleep(700);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add npm script + commit**

```json
"sync:ebay": "node --env-file=.env.local scripts/sync-ebay-sold-listings.mjs",
```

```bash
git add scripts/sync-ebay-sold-listings.mjs package.json
git commit -m "feat(sync): eBay sold-listings approximation via Browse API

Blocked on EBAY_CLIENT_ID + EBAY_CLIENT_SECRET env vars.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Update orchestrator `sync-all.sh`

**Files:** Modify `scripts/sync-all.sh`

- [ ] **Step 1: Replace contents**

```bash
#!/usr/bin/env bash
# scripts/sync-all.sh — orchestrates every data source.
# Each step no-ops gracefully if its required env vars are missing.
set -e
cd "$(dirname "$0")/.."

# Load .env.local into the current shell so the `run_if` env-var check sees them.
if [[ -f .env.local ]]; then
  set -a
  . .env.local
  set +a
fi

run_if() {
  local name="$1"; shift
  local script="$1"; shift
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      echo "[sync-all] SKIP $name (missing $var)"
      return 0
    fi
  done
  echo "[sync-all] RUN $name"
  node --env-file=.env.local "$script" || echo "[sync-all] WARN $name failed (continuing)"
}

# Catalog spine FIRST.
run_if rebrickable scripts/sync-rebrickable-catalog.mjs REBRICKABLE_API_KEY

# Enrichment + pricing in parallel.
run_if pricecharting scripts/sync-pricecharting-to-dynamo.mjs PRICECHARTING_API_TOKEN &
run_if brickset scripts/sync-brickset-enrichment.mjs BRICKSET_API_KEY BRICKSET_USERNAME BRICKSET_PASSWORD &
run_if bricklink scripts/sync-bricklink-pricing.mjs BRICKLINK_CONSUMER_KEY BRICKLINK_CONSUMER_SECRET BRICKLINK_TOKEN_VALUE BRICKLINK_TOKEN_SECRET &
run_if ebay scripts/sync-ebay-sold-listings.mjs EBAY_CLIENT_ID EBAY_CLIENT_SECRET &
run_if trends scripts/sync-google-trends.mjs &
run_if community scripts/sync-community.mjs &
wait

# Supplementary PC chart scrape.
run_if pc-history scripts/scrape-pricecharting-history.mjs PRICECHARTING_API_TOKEN

echo "[sync-all] complete"
```

- [ ] **Step 2: `chmod +x scripts/sync-all.sh && bash scripts/sync-all.sh`** — should run PC + trends + community, skip the rest with clear `SKIP` lines.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-all.sh
git commit -m "feat(sync): orchestrator skips sources whose env vars are unset

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: Migrate `lego-search.ts` to read full catalog from DDB

**Files:**
- Modify: `src/lib/db/lego-search.ts`
- Test: `tests/lib/db/lego-search.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();
vi.mock("@/lib/db/dynamo", () => ({
  getDynamo: () => ({ send: mockSend }),
  getTableName: () => "legofuture-cache",
}));

import { loadStoredCatalog } from "@/lib/db/lego-search";

describe("loadStoredCatalog", () => {
  beforeEach(() => mockSend.mockReset());
  it("returns all CATALOG rows via Scan pagination", async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ id: "75192", name: "Falcon", pricingProviderCount: 2 }], LastEvaluatedKey: { pk: "x" } })
      .mockResolvedValueOnce({ Items: [{ id: "10299", name: "Real Madrid", pricingProviderCount: 1 }], LastEvaluatedKey: undefined });
    const res = await loadStoredCatalog({ includeOrphans: true });
    expect(res).toHaveLength(2);
  });
  it("filters out non-eligible by default", async () => {
    mockSend.mockResolvedValueOnce({ Items: [
      { id: "A", pricingProviderCount: 2 },
      { id: "B", pricingProviderCount: 0 },
    ], LastEvaluatedKey: undefined });
    const res = await loadStoredCatalog();
    expect(res.map((r: any) => r.id)).toEqual(["A"]);
  });
});
```

- [ ] **Step 2: Refactor**

Replace the current loader (which uses `QueryCommand` with `pk = "CATALOG"`) with a paginated Scan:

```ts
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { isEligibleForDashboard } from "@/lib/domain/lego-catalog-eligibility";
import type { LegoSet } from "@/lib/types/lego";
import { getDynamo, getTableName } from "@/lib/db/dynamo";

export async function loadStoredCatalog(opts?: { includeOrphans?: boolean }): Promise<LegoSet[]> {
  const ddb = getDynamo();
  const table = getTableName();
  const all: LegoSet[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: table,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ExclusiveStartKey,
    }));
    for (const item of res.Items || []) all.push(item as LegoSet);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  if (opts?.includeOrphans) return all;
  return all.filter(isEligibleForDashboard);
}
```

Keep other exports in the file intact; only `loadStoredCatalog` changes.

- [ ] **Step 3: Run vitest, expect PASS**

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/lego-search.ts tests/lib/db/lego-search.test.ts
git commit -m "refactor(db): lego-search reads full CATALOG keyspace + eligibility filter

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 11: "Show all sets" toggle in dashboard

**Files:**
- Modify: `src/components/sets/forecast-dashboard.tsx` (or the catalog page server component)
- Modify: the API route or server action that calls `loadStoredCatalog`, to accept `includeOrphans`

- [ ] **Step 1: Find call site** — `grep -r "loadStoredCatalog" src/` to confirm the entry point. Likely a server component at `src/app/set-forecast/page.tsx` or an API route.

- [ ] **Step 2: Add `includeOrphans` query param**

In the server component / route handler, read `searchParams?.includeOrphans === "1"` and pass it through:

```ts
const catalog = await loadStoredCatalog({ includeOrphans: searchParams?.includeOrphans === "1" });
```

- [ ] **Step 3: Add toggle UI**

In the dashboard component, add a controlled link (server component pattern — no client state needed):

```tsx
<Link
  href={includeOrphans ? "/set-forecast" : "/set-forecast?includeOrphans=1"}
  className="text-sm text-muted-foreground hover:underline"
>
  {includeOrphans ? "Hide untracked sets" : "Show all sets (incl. no pricing data)"}
</Link>
```

- [ ] **Step 4: Render placeholder for orphans**

In `SetForecastCard` (or equivalent), when `pricingProviderCount === 0`, render `<p className="text-muted-foreground italic">Tracking — no market data yet</p>` in place of the price/projection block.

- [ ] **Step 5: Smoke** — `npm run dev`, hit `/set-forecast`. Toggle link visible; no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/sets src/app/set-forecast
git commit -m "feat(ui): show-all-sets toggle for orphan sets without pricing

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 12: Smoke test script

**Files:** Create `scripts/smoke-test-sync.mjs`

- [ ] **Step 1: Create**

```js
#!/usr/bin/env node
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { writeFile, mkdir } from "node:fs/promises";

const TABLE = process.env.DYNAMODB_TABLE || "legofuture-cache";
const REGION = process.env.AWS_REGION || "us-east-1";
const LIMIT = Number(process.env.SMOKE_LIMIT || 50);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });

async function randomSets() {
  const all = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(pk, :p) AND sk = :sk",
      ExpressionAttributeValues: { ":p": "CATALOG#PRODUCT#", ":sk": "v1" },
      ProjectionExpression: "id, pricingProviderCount",
      ExclusiveStartKey,
    }));
    for (const i of res.Items || []) all.push(i);
    ExclusiveStartKey = res.LastEvaluatedKey;
    if (all.length >= LIMIT * 5) break;
  } while (ExclusiveStartKey);
  return all.sort(() => Math.random() - 0.5).slice(0, LIMIT);
}

async function describe(setNum) {
  const out = { setNum, sources: {} };
  for (const [name, pk] of [
    ["catalog", `CATALOG#PRODUCT#${setNum}`],
    ["pricing", `PRICING#PRODUCT#${setNum}`],
    ["history", `HISTORY#PRODUCT#${setNum}`],
    ["community", `COMMUNITY#PRODUCT#${setNum}`],
  ]) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      Limit: 5,
    }));
    out.sources[name] = (res.Items || []).length;
  }
  return out;
}

async function main() {
  await mkdir("tmp", { recursive: true });
  const sets = await randomSets();
  const report = [];
  for (const s of sets) report.push(await describe(s.id));
  await writeFile("tmp/smoke-report.json", JSON.stringify(report, null, 2));
  const complete = report.filter((r) => r.sources.catalog && r.sources.pricing).length;
  console.log(`[smoke] ${complete}/${report.length} sets have catalog+pricing rows`);
  console.log(`[smoke] report → tmp/smoke-report.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add npm script + commit**

```json
"smoke:sync": "node --env-file=.env.local scripts/smoke-test-sync.mjs",
```

```bash
git add scripts/smoke-test-sync.mjs package.json
git commit -m "feat(scripts): smoke-test-sync surveys 50 random sets across DDB partitions

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 13: Final verify + push

- [ ] **Step 1: `npm run verify`** — lint + test + build green.

- [ ] **Step 2: `npm run smoke:sync`** — expect 50/50 catalog rows; pricing counts vary by which keys are provisioned.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin lf-plan-a-ingest
gh pr create --title "Plan A: multi-source ingestion + full-catalog runtime" --body "Implements docs/superpowers/specs/2026-05-17-multisource-lego-ml-forecast-design.md Phase 1.

Shipped now (no key dependency):
- DDB key constants + eligibility predicate
- PriceCharting sync bug fix (q=lego + filter)
- sync-all.sh orchestrator with graceful key-gating
- Runtime reads full CATALOG keyspace; show-all toggle
- Smoke-test script

Coded but blocked on API keys (runs when env vars land):
- Rebrickable, BrickLink, Brickset, eBay sync scripts

Plan B (ML training) blocked on full sync run completing."
```

---

## Self-Review

**Spec coverage:**
- Phase 1.1 Rebrickable → Task 5 ✓
- Phase 1.2 Brickset → Task 7 ✓
- Phase 1.3 BrickLink → Task 6 ✓
- Phase 1.4 PriceCharting fix → Task 4 ✓
- Phase 1.5 eBay → Task 8 ✓
- Phase 1.6/7 Trends/Community → existing scripts called from Task 9 orchestrator ✓
- Phase 1.8 sync-all.sh → Task 9 ✓
- DDB keyspace → Task 1 ✓
- Runtime full-catalog read → Task 10 ✓
- "Show all" toggle → Task 11 ✓
- Smoke test → Task 12 ✓
- Eligibility gate → Task 2 + 10 ✓

Plan B (training) + Plan C (CI + drift) intentionally out of scope.

**Placeholder scan:** No "TBD"; every code step is a complete implementation; commit messages spelled out.

**Type consistency:** `LegoSet` extended in Task 3 with the same fields Task 10 reads + sync scripts write (`enrichmentStatus`, `pricingProviderCount`).

**Risks called out in plan/spec:**
- `ScanCommand` not `QueryCommand` at 5K+ scale — acceptable for monthly sync; revisit GSI for runtime in Plan C.
- BrickLink ~5 rps rate-limit is empirical; script paces at 200 ms (5 rps); back off if 429s appear.
- eBay sold-listings via Browse API is an approximation; true Marketplace Insights needs app approval. Documented in code comment.
