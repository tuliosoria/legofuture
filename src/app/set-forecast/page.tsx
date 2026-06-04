import type { Metadata } from "next";
import { LEGO_SETS } from "@/lib/data/sets";
import { ForecastFilters } from "@/components/sets/ForecastFilters";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Set Forecast — LegoFuture",
  description:
    "Browse 5-year price forecasts for 50 investment-grade LEGO sets. Filter by theme, signal, and status.",
};

export default function SetForecastPage() {
  return (
    <main className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
      <div className="mb-8">
        <p className="type-eyebrow text-slate-500">Forecast catalog</p>
        <h1
          className="type-h1 mt-2"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          Set Forecast
        </h1>
        <p className="type-body text-slate-700 mt-3 max-w-2xl">
          5-year price forecasts for {LEGO_SETS.length} hand-picked LEGO sets across modular,
          UCS, Icons, Technic, and more. Filter and sort to find your edge.
        </p>
      </div>

      <ForecastFilters sets={LEGO_SETS} />

      <p className="type-caption text-slate-500 mt-10 leading-relaxed">
        Educational forecasts only — not financial advice. LEGO is a trademark of the LEGO Group;
        LegoFuture is not affiliated with or endorsed by the LEGO Group.
      </p>
    </main>
  );
}
