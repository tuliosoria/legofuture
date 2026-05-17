import type { Metadata } from "next";
import { loadStoredCatalog } from "@/lib/db/lego-search";
import { getPricing } from "@/lib/domain/lego-estimate";
import { computeForecast } from "@/lib/domain/lego-forecast";
import { ForecastDashboard } from "@/components/sets/ForecastDashboard";
import { HeroStats } from "@/components/HeroStats";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title: "LEGO Set Forecast | LegoFuture",
  description:
    "Browse price forecasts for LEGO sets. Filter by theme, retirement status, and investment signal.",
};

/**
 * SSR cap for orphan sets. Prevents Lambda timeout when includeOrphans=true
 * until GSI-based pagination is available (Plan C / TODO(GSI)).
 * The real catalog total is resolved client-side via /api/sets/catalog.
 * @deprecated Migrate to the paginated /api/sets/catalog endpoint.
 */
const SSR_ORPHAN_CAP = 200;

/** Number of items to compute forecasts for server-side (fast first paint). */
const SSR_FIRST_PAGE = 60;

/** Fallback pricing when no PriceCharting data exists. */
const EMPTY_PRICING = {
  newPrice: null,
  cibPrice: null,
  loosePrice: null,
  salesVolume: null,
  lastFetched: "",
} as const;

export default async function SetForecastPage({
  searchParams,
}: {
  searchParams?: Promise<{ includeOrphans?: string }> | { includeOrphans?: string };
}) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const includeOrphans = params.includeOrphans === "1";

  // Load catalog — orphan scan capped to SSR_ORPHAN_CAP to prevent timeout.
  // Client discovers the real total via /api/sets/catalog (Plan C).
  const catalog = await loadStoredCatalog({
    includeOrphans,
    orphanCap: includeOrphans ? SSR_ORPHAN_CAP : undefined,
  });

  const initialTotal = catalog.length;
  const firstPage = catalog.slice(0, SSR_FIRST_PAGE);

  const initialItems = await Promise.all(
    firstPage.map(async (product) => {
      const pricing = await getPricing(product);
      const forecast = computeForecast(product, pricing ?? EMPTY_PRICING);
      return { product, forecast };
    })
  );

  return (
    <main>
      {/* Page header */}
      <div className="bg-pure-white border-b-2 border-jet-black">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
          <p className="type-eyebrow text-slate-500 mb-2">Set forecasts</p>
          <h1 className="type-display-2 text-jet-black mb-3">
            Build your position.
          </h1>
          <p className="type-body-lg text-slate-700 max-w-xl">
            Data-driven 5-year return projections for sealed-in-box LEGO sets.
            Filter by theme, status, or investment signal.
          </p>
          <div className="mt-4">
            <HeroStats />
          </div>
        </div>
      </div>
      <ForecastDashboard
        initialItems={initialItems}
        initialTotal={initialTotal}
        includeOrphans={includeOrphans}
      />
    </main>
  );
}
