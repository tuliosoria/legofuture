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

export default async function SetForecastPage() {
  const catalog = await loadStoredCatalog();

  const items = await Promise.all(
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
      <ForecastDashboard items={items} />
    </main>
  );
}
