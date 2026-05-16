import type { Metadata } from "next";
import { loadStoredCatalog } from "@/lib/db/sealed-search";
import { getPricingFromBundle } from "@/lib/domain/sealed-estimate";
import { computeForecast } from "@/lib/domain/sealed-forecast";
import { ForecastDashboard } from "@/components/sealed/ForecastDashboard";

export const metadata: Metadata = {
  title: "Sealed LEGO Forecast | LegoFuture",
  description:
    "Browse price forecasts for sealed LEGO sets. Filter by theme, retirement status, and investment signal.",
};

export default async function SealedForecastPage() {
  const catalog = await loadStoredCatalog();

  const items = catalog.map((product) => {
    const pricing = getPricingFromBundle(product.id);
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
  });

  return (
    <main>
      {/* Page header */}
      <div className="bg-pure-white border-b-2 border-jet-black">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
          <p className="type-eyebrow text-slate-500 mb-2">Sealed set forecasts</p>
          <h1 className="type-display-2 text-jet-black mb-3">
            Build your position.
          </h1>
          <p className="type-body-lg text-slate-700 max-w-xl">
            Data-driven 5-year return projections for sealed-in-box LEGO sets.
            Filter by theme, status, or investment signal.
          </p>
        </div>
      </div>
      <ForecastDashboard items={items} />
    </main>
  );
}
