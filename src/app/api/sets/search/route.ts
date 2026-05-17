import { NextRequest, NextResponse } from "next/server";
import { loadStoredCatalog } from "@/lib/db/lego-search";
import { getPricing } from "@/lib/domain/lego-estimate";
import { computeForecast } from "@/lib/domain/lego-forecast";
import { enforceIpRateLimit } from "@/lib/db/rate-limit";
import { coerceTheme } from "@/lib/data/lego-themes";
import {
  runFilterPipeline,
  type CatalogItem,
  type FilterState,
  type RecommendationFilter,
  type SortKey,
  type StatusFilter,
} from "@/lib/domain/lego-filter";
import type { LegoTheme, Scenario } from "@/lib/types/lego";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ReadonlySet<StatusFilter> = new Set([
  "all",
  "active",
  "retiring",
  "retired",
]);
const VALID_RECS: ReadonlySet<RecommendationFilter> = new Set([
  "all",
  "buy",
  "hold",
  "sell",
]);
const VALID_SORTS: ReadonlySet<SortKey> = new Set([
  "upside",
  "price-asc",
  "price-desc",
  "confidence",
  "pieces-asc",
  "pieces-desc",
  "retirement",
]);
const VALID_SCENARIOS: ReadonlySet<Scenario> = new Set([
  "pessimist",
  "moderate",
  "optimist",
]);

function readThemes(searchParams: URLSearchParams): LegoTheme[] {
  const raw = [
    ...searchParams.getAll("theme"),
    ...searchParams.getAll("themes"),
  ]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  // coerceTheme falls back to "Other" for anything unknown. We only want
  // an explicit "other" token to filter the Other bucket — silently
  // coercing typos like "Nonexistent" into Other would mis-filter the
  // catalog. Drop tokens whose coerced value differs from the input
  // (case-insensitive, and ignoring slug vs name differences).
  const themes = raw
    .map((token) => ({ token, coerced: coerceTheme(token) }))
    .filter(({ token, coerced }) => {
      const t = token.toLowerCase();
      if (coerced !== "Other") return true;
      return t === "other";
    })
    .map(({ coerced }) => coerced);
  return Array.from(new Set(themes));
}

export async function GET(request: NextRequest) {
  const blocked = await enforceIpRateLimit(request, {
    bucket: "set-search-ip",
    windowSec: 60,
    max: 120,
  });
  if (blocked) return blocked;

  const sp = request.nextUrl.searchParams;
  const query = sp.get("q") ?? "";
  const themes = readThemes(sp);
  const statusRaw = (sp.get("status") ?? "all") as StatusFilter;
  const recRaw = (sp.get("recommendation") ?? "all") as RecommendationFilter;
  const sortRaw = (sp.get("sort") ?? "upside") as SortKey;
  const scenarioRaw = (sp.get("scenario") ?? "moderate") as Scenario;

  const status: StatusFilter = VALID_STATUSES.has(statusRaw) ? statusRaw : "all";
  const recommendation: RecommendationFilter = VALID_RECS.has(recRaw)
    ? recRaw
    : "all";
  const sort: SortKey = VALID_SORTS.has(sortRaw) ? sortRaw : "upside";
  const scenario: Scenario = VALID_SCENARIOS.has(scenarioRaw)
    ? scenarioRaw
    : "moderate";

  const catalog = await loadStoredCatalog();

  const items: CatalogItem[] = await Promise.all(
    catalog.map(async (product) => {
      const pricing = await getPricing(product);
      const forecast = computeForecast(
        product,
        pricing ?? {
          newPrice: product.originalMsrp ?? 0,
          cibPrice: null,
          loosePrice: null,
          salesVolume: null,
          lastFetched: "",
        }
      );
      return { product, forecast };
    })
  );

  const filterState: FilterState = {
    query,
    themes,
    status,
    recommendation,
    scenario,
    sort,
  };
  const { results, aliases } = runFilterPipeline(items, filterState);

  const body = {
    total: catalog.length,
    matched: results.length,
    scenario,
    sets: results.map(({ product }) => product),
    appliedAliases:
      aliases.theme || aliases.status || aliases.freeText
        ? {
            theme: aliases.theme,
            status: aliases.status,
            freeText: aliases.freeText || undefined,
          }
        : undefined,
  };

  const freshness = new Date().toISOString();
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Data-Freshness": freshness,
    },
  });
}
