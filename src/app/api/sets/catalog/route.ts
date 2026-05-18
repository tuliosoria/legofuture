import { NextRequest, NextResponse } from "next/server";
import { loadStoredCatalog } from "@/lib/db/lego-search";
import { getPricing } from "@/lib/domain/lego-estimate";
import { computeForecast } from "@/lib/domain/lego-forecast";
import { loadBaseline } from "@/lib/domain/lego-baseline";
import { matchesFreeText, matchesStatus } from "@/lib/domain/lego-filter";
import type { LegoSet, ProductPricing } from "@/lib/types/lego";

export const dynamic = "force-dynamic";

/**
 * GET /api/sets/catalog
 *
 * Paginated catalog endpoint. Loads the full catalog server-side, applies
 * filters + sorting, then returns a page-sized slice.
 *
 * Query params:
 *   page          — 1-based page number (default 1)
 *   limit         — items per page, capped at 120 (default 60)
 *   q             — free-text search on name / setNumber / theme
 *   theme         — exact theme name filter
 *   status        — "all" | "active" | "retired"
 *   sort          — "name" | "upside" | "pieces-desc" | "release" (default "name")
 *   includeOrphans— "1" to include Rebrickable-only sets without pricing data
 *
 * Returns:
 *   { items: CatalogItem[], total: number, page: number, limit: number, hasMore: boolean }
 *
 * // TODO(GSI): This route loads the full DDB catalog on every request (Scan).
 * // Once a GSI on pricingProviderCount or theme is available, replace the
 * // full scan with targeted Query calls to reduce read capacity consumption.
 */

const MAX_LIMIT = 120;
const DEFAULT_LIMIT = 60;

const DEFAULT_PRICING: ProductPricing = {
  newPrice: null,
  cibPrice: null,
  loosePrice: null,
  salesVolume: null,
  lastFetched: "",
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const pageRaw = Number(sp.get("page") ?? "1");
  const limitRaw = Number(sp.get("limit") ?? String(DEFAULT_LIMIT));
  const q = (sp.get("q") ?? "").trim();
  const themeFilter = sp.get("theme") ?? "";
  const statusFilter = sp.get("status") ?? "all";
  const sort = sp.get("sort") ?? "name";
  const includeOrphans = sp.get("includeOrphans") === "1";

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);
  const page = pageRaw;

  // Load full catalog. The /api/sets/catalog route owns pagination so it
  // always requests the full set of matching items.
  // TODO(GSI): replace with targeted GSI query once available.
  const catalog = await loadStoredCatalog({ includeOrphans });

  // --- server-side filtering -----------------------------------------------
  let filtered = catalog.filter((set: LegoSet) => {
    if (q && !matchesFreeText(set, q)) return false;
    if (themeFilter && set.theme !== themeFilter) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (statusFilter !== "all" && !matchesStatus(set, statusFilter as any)) return false;
    return true;
  });

  // --- server-side sorting (basic; ROI sort done client-side) ---------------
  switch (sort) {
    case "pieces-desc":
      filtered = filtered.sort((a, b) => (b.pieceCount ?? 0) - (a.pieceCount ?? 0));
      break;
    case "release":
      filtered = filtered.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
      break;
    case "name":
    default:
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  const total = filtered.length;
  const withPricing = filtered.reduce(
    (n, set) => n + ((set.pricingProviderCount ?? 0) >= 1 ? 1 : 0),
    0,
  );
  const start = (page - 1) * limit;
  const pageItems = filtered.slice(start, start + limit);
  const hasMore = start + limit < total;

  // --- compute forecasts for this page only ---------------------------------
  const baseline = await loadBaseline();
  const items = await Promise.all(
    pageItems.map(async (product) => {
      const pricing = await getPricing(product);
      const forecast = computeForecast(product, pricing ?? DEFAULT_PRICING, baseline);
      return { product, forecast };
    })
  );

  return NextResponse.json(
    { items, total, withPricing, page, limit, hasMore },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
