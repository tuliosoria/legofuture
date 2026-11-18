import type { Metadata } from "next";
import Link from "next/link";
import { ForecastDashboard } from "@/components/sets/ForecastDashboard";

export const metadata: Metadata = {
  title: "Price catalog · BricksFuture",
  description: "Browse priced LEGO sets, including sets without an investment classification.",
};

export default function CatalogPage() {
  return (
    <main>
      <header className="mx-auto max-w-[1240px] px-4 md:px-8 pt-10">
        <h1 className="type-h1">Price catalog</h1>
        <p className="type-body text-slate-700 mt-3 max-w-2xl">
          Browse sets with pricing data. Inclusion is not an investment recommendation.
          Unclassified sets remain unclassified; the Investment Screener only shows
          sets with an explicit investment classification.
        </p>
        <p className="type-body-sm text-slate-600 mt-2">
          Coverage excludes products without a recorded pricing provider and small accessories.
          Market listings are asking prices, not confirmed sales. Forecasts are estimates.
        </p>
        <Link href="/set-forecast" className="inline-block mt-4 underline">Back to curated forecasts</Link>
      </header>
      <ForecastDashboard initialItems={[]} initialTotal={0} includeOrphans={false} loadOnMount />
    </main>
  );
}
