# LegoFuture — MVP Rebuild Design

**Status:** Awaiting user approval
**Author:** Copilot (autopilot, user unavailable for live brainstorm)
**Date:** 2026-06-03
**Brainstormed via:** `superpowers:brainstorming` skill

---

## 1. Goal

Reshape the existing LegoFuture codebase into a minimum-viable structure that mirrors `pokefuture.com` (its sibling product), keyed on a single hardcoded array of 50 LEGO sets. The framework, styling system, and component patterns stay; the data layer and most of the page surface get torn out and rebuilt.

## 2. What stays vs. what goes

### Stays untouched
| Area | Why |
|---|---|
| Next.js 16 + Tailwind v4 + recharts + Vitest stack | Spec: "do not change the framework, styling approach, or component patterns." |
| `design.md` LEGO design tokens (brick red, sunshine yellow, bright blue, Plus Jakarta Sans, hard shadows) | Already the source of truth; every new component conforms. |
| `src/components/ui/BrickCard.tsx` and other primitive UI | Reused as-is. |
| `src/components/layout/header.tsx`, `footer.tsx`, `first-visit-disclaimer.tsx` | Re-templated for new nav items but stay structurally. |
| `scripts/`, `lego-ml/`, `infra/lego-ml-retrainer/` | Not imported by the Next app — pipeline futures. Add a `_DORMANT.md` README explaining they're unwired until/unless we relight the data pipeline. |
| Eligible legal pages (`/contact`, `/terms`, `/privacy`, `/privacy-rights`) | Already exist; refresh copy for new methodology + LEGO-specific disclaimers. |

### Deleted (app-coupled cruft)
| Area | Reason |
|---|---|
| `src/app/api/sets/{catalog,search,forecast,history,pricing,top-buys,bricklink,vote}` | No client calls these once pages read from `LEGO_SETS` directly. |
| `src/app/api/trends/`, `src/app/api/health/` | Trends fed the screener; health is unused. |
| `src/lib/db/*` (DynamoDB modules) | Only consumers are the deleted API routes and pages. |
| `src/lib/domain/lego-{forecast,filter,investment-score,product-classifier,catalog-eligibility,catalog-search,ml-scoring,baseline,bricklink,estimate,fees,forecast-breakdown,hold-roi,key-drivers,retirement-roi,price-estimates}.ts` | Either screener/composite-score scaffolding (out of MVP scope) or DDB-backed logic replaced by the pure `src/lib/domain/forecast.ts` in the spec. **Kept:** `recommendation.ts`, `scenarios.ts`, `projection-series.ts`, `curated-score.ts`, `confidence-display.ts` if their public types still align with the new `LegoSet`. Verified during implementation; deleted if not. |
| `src/components/sets/{filter-sidebar,sort-menu,sort-controls,WatchlistCard,ProductForecastCard,ForecastDashboard,ForecastChart,ModelDetails,SignalBadge,SkeletonForecastCard,TopBuyOpportunities,search-box,condition-selector}.tsx` | All rebuilt for the new shape (most rewrites are surface-level — semantic shape changes, design tokens stay the same). |
| Pages: `/set/[slug]`, `/watchlist`, `/set-forecast/methodology`, `/legal` | Removed from sitemap. Routes return 301 redirects (see §4). |

### New
- `src/lib/domain/lego-set.ts` — single `LegoSet` type definition.
- `src/lib/data/sets.ts` — `LEGO_SETS: LegoSet[]` with all 50 records verbatim from the spec.
- `src/lib/domain/forecast.ts` — pure computation module: `roiPercent`, `cagr5`, `annualRoiLabel`, `outlookDots`, `retirementDots`, `communityDots`, `liquidityDots`, `agreementDots`, `scenarioRoi`, `ebayUrl`, `brickLinkUrl`. (Spec dictates every signature.)
- `src/app/buying-list/page.tsx` — top 15 by score.
- `src/app/api/contact/route.ts` — POST handler: parse form, log to console (no email provider wired yet), return 200.
- Component rebuilds (see §5).

---

## 3. Sitemap

```
/                       Homepage
/buying-list            Monthly top 15 picks
/set-forecast           Full catalog with filters (50 sets)
/set-forecast/[slug]    Individual set detail page
/contact                Form + methodology anchor + legal links
/terms                  Terms of use
/privacy                Privacy policy
/privacy-rights         Do Not Sell / privacy rights
```

## 4. Redirects (Next config `redirects()` or `middleware.ts`)

| From | To | Status |
|---|---|---|
| `/watchlist` | `/buying-list` | 301 |
| `/set-forecast/methodology` | `/contact#methodology` | 301 |
| `/set/[slug]` | `/set-forecast/[slug]` (preserve slug) | 301 |
| `/legal` | `/terms` | 301 |
| `/api/*` (any leftover) | 404 | — |

Implementation: use `next.config.ts` `redirects()` array. Permanent, statically resolved. The dynamic `/set/[slug]` → `/set-forecast/[slug]` rewrite uses a wildcard source: `/set/:slug*` → `/set-forecast/:slug*`.

## 5. Component architecture

```
src/components/
├── layout/
│   ├── header.tsx              Logo + Buying List + Set Forecast + Contact
│   ├── footer.tsx              3-col footer + bottom bar with legal/ePN disclaimer
│   └── first-visit-disclaimer.tsx   (keep as-is, copy refreshed)
├── ui/
│   ├── BrickCard.tsx           (kept)
│   ├── SignalPill.tsx          NEW: renders the 5 signal labels with design-token colors
│   ├── StatusTag.tsx           NEW: Active/Retiring soon/Retired with distinct visual treatment
│   ├── ConfidenceDots.tsx      NEW: 5-dot row, filled = green #1D9E75
│   └── DotsRow.tsx             NEW: generic 5-dot rating row (reused for "Why this rating")
└── sets/
    ├── SetCard.tsx             NEW: replaces ProductForecastCard. Used by /set-forecast and homepage rail.
    ├── BuyingListRow.tsx       NEW: ranked list row for /buying-list (rank + image + meta + thesis)
    ├── ForecastFilters.tsx     NEW: theme + signal + status + sort, all client-state, no fetch
    ├── DetailHero.tsx          NEW: tag/theme/setNumber/pieces + h1 + signal + dots + price row + CTAs
    ├── WhyThisRating.tsx       NEW: 5-row dot-rating card with per-tier copy
    ├── ScenarioCards.tsx       NEW: 3-card bear/base/bull row
    ├── ForecastChart.tsx       REBUILT: recharts, history extrapolation + forecast + S&P + bear/bull band
    ├── LiveMarketPanel.tsx     NEW: 4 metric cards
    └── ThesisBlock.tsx         NEW: investment-thesis paragraph + disclaimer
```

Every component is a **pure server component** unless it manages client state (only `ForecastFilters` and the contact form). No effects, no `useEffect` data fetching — pages read `LEGO_SETS` directly.

## 6. Data layer

```typescript
// src/lib/domain/lego-set.ts
export type LegoSet = {
  id: string
  name: string
  setNumber: string
  theme: string
  productType: string
  year: number
  status: "Active" | "Retiring soon" | "Retired"
  msrp: number
  currentPrice: number
  proj5y: number
  bear: number
  bull: number
  score: number
  signal: "Strong Buy" | "Buy" | "Watch" | "Hold" | "Sell"
  confidence: 1 | 2 | 3 | 4 | 5
  confLabel: "High" | "Medium" | "Low"
  pieces: number
  communityScore: number
  momentum: string         // "+18% 12mo"
  liquidity: string        // "High · 200+ listings"
  priceAgreement: string   // "92%"
  thesis: string
}
```

`src/lib/data/sets.ts` exports `LEGO_SETS: LegoSet[]` with all 50 records verbatim from the spec. **No deduplication, no validation at module load.** A single Vitest test asserts the array has exactly 50 entries with unique slugs.

## 7. Pure-computation module: `src/lib/domain/forecast.ts`

Implements the 11 helper functions from the spec verbatim. Every page consumes these and only these for derived numbers. Each helper has its own Vitest test (table-driven). Public API matches the spec exactly so the rest of the codebase stays decoupled from internal math.

## 8. Pages

### 8a. `/buying-list`
Server component. Sorts `LEGO_SETS` by `score` descending, slices to 15, maps to `BuyingListRow`. Layout per spec §4a (page header, datestamp, scoring explainer card, "Top 15 picks" heading, ranked rows, disclaimer). `revalidate = 3600`.

### 8b. `/set-forecast`
Server component renders the page chrome + initial cards; `ForecastFilters` is a client component that takes `LEGO_SETS` as a prop and renders the grid client-side with filter/sort state. No URL params — state is in-memory. Theme dropdown populated from `Array.from(new Set(LEGO_SETS.map(s => s.theme))).sort()`. `revalidate = 3600`.

### 8c. `/set-forecast/[slug]`
Server component. Per-section breakdown:
1. Breadcrumb `← All forecasts`
2. `DetailHero`
3. (signal row is part of `DetailHero`)
4. (price row is part of `DetailHero`)
5. (CTAs are part of `DetailHero`)
6. `WhyThisRating` — 5 rows, copy per the spec's per-tier scripts
7. `ScenarioCards` — 3 cards (bear/base/bull)
8. `ForecastChart` — recharts
9. `LiveMarketPanel` — 4 metric cards
10. `ThesisBlock` — investment thesis paragraph
11. Disclaimer (also lives in `ThesisBlock`)

`generateStaticParams` returns all 50 slugs. `generateMetadata` returns the per-set title/description from the spec. `revalidate = 3600`.

**Chart implementation detail:** Parse `momentum` like `"+18% 12mo"` → `0.18` annual rate. Back-cast 3yr history: monthly points where `price_t = currentPrice / (1 + r)^t_years`, with mild noise (±1.5% sinusoid) so the line doesn't look ruler-straight. Forward forecast: monthly points where `price_t = currentPrice * (proj5y/currentPrice)^(t/5)`. S&P baseline: monthly compound `currentPrice * 1.105^t`. Bear/bull shaded band: same exponential through `(currentPrice, 5y, bear)` and `(currentPrice, 5y, bull)`.

### 8d. `/`
Server component. Hero + top-6 rail (sort by score, slice 6, render `SetCard`) + 3-pillar explainer + live stats strip (counts computed from `LEGO_SETS`) + footer. The stats strip computes:
- `${LEGO_SETS.length} sets tracked` (not the literal "100" in the spec — actual count)
- `${LEGO_SETS.filter(s => s.signal === "Buy" || s.signal === "Strong Buy").length} Buy signals`
- `${LEGO_SETS.filter(s => s.status === "Retiring soon").length} Retiring soon`
- "5yr forecast horizon"

### 8e. `/contact`
Two-column layout. Left: `ContactForm` client component, `POST /api/contact`. Right: methodology block with `id="methodology"` for the deep-link anchor. Legal links at bottom.

### 8f. Legal pages
`/terms`, `/privacy`, `/privacy-rights` — keep current copy if compliant, refresh boilerplate to mention LEGO Group trademark and eBay Partner Network disclosure.

## 9. Styling & visual treatment

All colors and type come from `design.md` tokens. Mappings:

| Surface | Token |
|---|---|
| Page background | `--color-paper` (#FAF7F0) |
| Card surface | `--color-pure-white` (#FFFFFF) |
| Signal: Strong Buy | `--color-brick-red` |
| Signal: Buy | `--color-bright-blue` |
| Signal: Watch / Hold | `--color-sunshine-yellow` |
| Signal: Sell | `--color-slate-700` |
| Status: Retired | `--color-pure-green` (capped supply = bullish) |
| Status: Retiring soon | `--color-sunshine-yellow` |
| Status: Active | `--color-slate-300` (neutral) |
| Confidence dots filled | `#1D9E75` (per spec; close to `--color-success`) |
| ROI positive | `--color-pure-green` |
| ROI negative | `--color-brick-red` |
| Bear scenario | `--color-brick-red` |
| Bull scenario | `--color-pure-green` |
| Base scenario | `--color-bright-blue` |

Headings: Plus Jakarta Sans 800. Body: Inter 400/500. Borders: hairline `--color-slate-100`. Hard shadows per design.md.

## 10. Environment

Add to `.env.example`:
```
NEXT_PUBLIC_EBAY_CAMPAIGN_ID=
CONTACT_EMAIL=
```

`next.config.ts`:
- Add `img.bricklink.com` to `images.remotePatterns` so `<Image>` can load `https://img.bricklink.com/ItemImage/SN/0/{setNumber}-1.png`.
- Add the four redirects in `redirects()`.

## 11. Testing strategy (Vitest)

| Test | Coverage |
|---|---|
| `forecast.test.ts` | All 11 helpers in `src/lib/domain/forecast.ts`, table-driven. |
| `sets.test.ts` | `LEGO_SETS.length === 50`, all slugs unique, all required fields present, `bear ≤ proj5y ≤ bull`. |
| `signal-pill.test.tsx` | Renders correct token-driven color class per signal value. |
| `confidence-dots.test.tsx` | Renders N filled / 5−N unfilled. |
| `buying-list.test.ts` | Top 15 ordered by score desc, contains expected highest-score sets. |
| `forecast-filters.test.tsx` | Theme/signal/status filter narrowing + sort ordering. |
| `chart-series.test.ts` | Back-cast and forward-cast series are monotonic in the expected direction; S&P baseline math matches `1.105^t`. |

No new external tooling. `npm run verify` (lint + test + build) must exit 0 before completion.

## 12. Definition of done (verbatim from spec, restated)

- All 8 sitemap pages render with no runtime errors.
- `/buying-list` shows exactly 15 ranked sets with correct prices/signals/eBay links.
- `/set-forecast` filters and sorts client-side across all 50 sets.
- `/set-forecast/[slug]` renders all sections for every slug with no missing fields.
- Signal pills, confidence dots, and status tags are color-correct per §9.
- Homepage stats strip shows live counts (not hardcoded "100").
- All deleted routes 301-redirect.
- `npm run verify` exit 0 (lint + test + build).
- Mobile-responsive at 375px viewport.
- Footer disclaimer present on every page.
- `generateStaticParams` covers all 50 slugs.
- `next.config.ts` allows `img.bricklink.com`.

## 13. Out of scope (explicit)

- Re-igniting the DDB / sync-script / ML pipeline (sits dormant in `scripts/`, `lego-ml/`, `infra/`).
- The screener feature (investment-score, liquidity-tier, outlier flags) — deleted along with `lego-investment-score.ts`.
- Real email delivery from the contact form (console-log only; wire Resend/Postmark later).
- Watchlist / vote endpoints.
- Server-side filtering or pagination of `/set-forecast`.
- Real eBay overlay (the catalog page just deep-links via `ebayUrl()`).

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| BrickLink image URLs (`img.bricklink.com/ItemImage/SN/0/...png`) return 404 for some sets | Wrap `<Image>` with `onError` fallback to a generic LEGO placeholder asset under `/public`. |
| `recharts` SSR mismatch | Render the chart in a client component; pass pre-computed series as props from the server page. |
| Pre-existing tests in `tests/` reference deleted modules | Delete those tests with the corresponding modules; new tests under `tests/` cover the new surface. |
| Design.md tokens not yet in Tailwind config | Verify during implementation; if missing, add CSS vars to `globals.css` and Tailwind theme. |
| Disclaimers might inadvertently use "LEGO" as a verb or brand differentiator implying affiliation | Boilerplate in every page footer; legal team would normally bless — copy mirrors PokeFuture's existing disclaimers verbatim. |

## 15. Implementation sequencing (preview — full plan generated separately)

1. **Foundation**: type + data + forecast helpers + tests. Commit.
2. **Teardown**: delete API routes, DDB modules, dead domain files, dead components, removed pages. Add redirects. Build must stay green. Commit.
3. **Primitives**: `SignalPill`, `StatusTag`, `ConfidenceDots`, `DotsRow` + tests. Commit.
4. **Set card + buying-list row + forecast filters** + tests. Commit.
5. **Detail-page sections** (`DetailHero`, `WhyThisRating`, `ScenarioCards`, `ForecastChart`, `LiveMarketPanel`, `ThesisBlock`). Commit.
6. **Pages wired** (`/`, `/buying-list`, `/set-forecast`, `/set-forecast/[slug]`, `/contact`, refreshed legal pages). Commit.
7. **Header/footer/nav refresh** + `next.config.ts` redirects + `images.remotePatterns`. Commit.
8. **Final verify**: `npm run verify`, manual responsive check at 375px, all 50 detail pages spot-check, redirects spot-check. Commit if anything was tweaked.

Each commit must pass `npm run verify`.

---

## Approval gate

Per the `superpowers:brainstorming` skill's HARD-GATE, **no implementation begins until this design is approved.** Review and either:
1. Approve → I invoke `superpowers:writing-plans` to generate the per-step implementation plan, then execute.
2. Request changes → I revise this spec and re-self-review.
