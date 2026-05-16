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
      <div className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-screen-xl px-4 py-8">
          <h1 className="text-3xl font-extrabold">Sealed LEGO Set Forecasts</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] max-w-xl">
            Data-driven 5-year return projections for sealed-in-box LEGO sets. Filter by
            theme, status, or investment signal.
          </p>
        </div>
      </div>
      <ForecastDashboard items={items} />
    </main>
  );
}
