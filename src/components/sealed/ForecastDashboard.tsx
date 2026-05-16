"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { SealedProduct, Forecast, LegoTheme, Scenario } from "@/lib/types/sealed";
import { ProductForecastCard } from "./ProductForecastCard";
import { SkeletonForecastCard } from "./SkeletonForecastCard";
import { TopBuyOpportunities } from "./TopBuyOpportunities";
import { ChipBadge } from "@/components/ui/ChipBadge";

interface CatalogItem {
  product: SealedProduct;
  forecast: Forecast;
}

interface ForecastDashboardProps {
  items: CatalogItem[];
  loading?: boolean;
}

const ALL_THEMES: LegoTheme[] = [
  "Icons", "Star Wars", "Harry Potter", "Technic", "Ideas",
  "Modular Buildings", "Architecture", "Marvel", "Friends", "GWP", "Other",
];

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "pessimist", label: "Pessimist" },
  { value: "moderate", label: "Moderate" },
  { value: "optimist", label: "Optimist" },
];

const SORT_OPTIONS = [
  { value: "roi", label: "Highest ROI" },
  { value: "price", label: "Highest Value" },
  { value: "signal", label: "Growth Rate" },
];

const SIGNALS = [
  { value: "Buy" as const, label: "Buy", color: "blue" as const },
  { value: "Hold" as const, label: "Hold", color: "yellow" as const },
  { value: "Sell" as const, label: "Sell", color: "black" as const },
];

export function ForecastDashboard({ items, loading }: ForecastDashboardProps) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<LegoTheme | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "retired" | "current">("");
  const [signal, setSignal] = useState<"" | "Buy" | "Hold" | "Sell">("");
  const [scenario, setScenario] = useState<Scenario>("moderate");
  const [sort, setSort] = useState("roi");

  const topBuys = useMemo(
    () =>
      items
        .filter(({ forecast }) => forecast.signal === "Buy")
        .sort((a, b) => b.forecast.roiPercent - a.forecast.roiPercent)
        .slice(0, 5),
    [items]
  );

  const filtered = useMemo(() => {
    let out = items;
    const q = query.toLowerCase().trim();
    if (q)
      out = out.filter(
        ({ product }) =>
          product.name.toLowerCase().includes(q) ||
          product.setNumber.includes(q) ||
          product.theme.toLowerCase().includes(q)
      );
    if (theme) out = out.filter(({ product }) => product.theme === theme);
    if (statusFilter === "retired") out = out.filter(({ product }) => product.retired);
    if (statusFilter === "current") out = out.filter(({ product }) => !product.retired);
    if (signal) out = out.filter(({ forecast }) => forecast.signal === signal);

    const scenarioData = (f: Forecast) => f.scenarios[scenario] ?? f;
    out = [...out].sort((a, b) => {
      const fa = scenarioData(a.forecast);
      const fb = scenarioData(b.forecast);
      switch (sort) {
        case "price": return fb.projectedValue - fa.projectedValue;
        case "signal": return fb.annualRate - fa.annualRate;
        default: return fb.roiPercent - fa.roiPercent;
      }
    });
    return out;
  }, [items, query, theme, statusFilter, signal, scenario, sort]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
      {/* Top Buys */}
      {!loading && topBuys.length > 0 && (
        <div className="mb-10">
          <TopBuyOpportunities items={topBuys} />
        </div>
      )}

      {/* Filter row */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets…"
            className="w-full h-11 rounded-card border-2 border-jet-black bg-pure-white py-2 pl-9 pr-4 type-body-sm text-jet-black placeholder:text-slate-500 focus:outline-none focus:ring-[3px] focus:ring-bright-blue"
          />
        </div>

        {/* Chip filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Signal */}
          <span className="type-eyebrow text-slate-500 mr-1">Signal:</span>
          <ChipBadge
            color="slate"
            active={signal === ""}
            onClick={() => setSignal("")}
          >
            All
          </ChipBadge>
          {SIGNALS.map(({ value, label, color }) => (
            <ChipBadge
              key={value}
              color={color}
              active={signal === value}
              onClick={() => setSignal(signal === value ? "" : value)}
            >
              {label}
            </ChipBadge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Status */}
          <span className="type-eyebrow text-slate-500 mr-1">Status:</span>
          {(["", "retired", "current"] as const).map((s) => (
            <ChipBadge
              key={s || "all"}
              color="slate"
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {s === "" ? "All" : s === "retired" ? "Retired" : "In Production"}
            </ChipBadge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Scenario */}
          <span className="type-eyebrow text-slate-500 mr-1">Scenario:</span>
          {SCENARIOS.map(({ value, label }) => (
            <ChipBadge
              key={value}
              color={value === "optimist" ? "green" : value === "moderate" ? "blue" : "black"}
              active={scenario === value}
              onClick={() => setScenario(value)}
            >
              {label}
            </ChipBadge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Theme */}
          <span className="type-eyebrow text-slate-500 mr-1">Theme:</span>
          <ChipBadge
            color="slate"
            active={theme === ""}
            onClick={() => setTheme("")}
          >
            All
          </ChipBadge>
          {ALL_THEMES.map((t) => (
            <ChipBadge
              key={t}
              color="slate"
              active={theme === t}
              onClick={() => setTheme(theme === t ? "" : t)}
            >
              {t}
            </ChipBadge>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="type-eyebrow text-slate-500">Sort:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-card border-2 border-jet-black bg-pure-white px-3 py-1.5 type-body-sm focus:outline-none focus:ring-2 focus:ring-bright-blue"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="mb-4 type-body-sm text-slate-500">
          {filtered.length} set{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {loading
          ? [...Array(10)].map((_, i) => <SkeletonForecastCard key={i} />)
          : filtered.map(({ product, forecast }) => (
              <ProductForecastCard key={product.id} product={product} forecast={forecast} />
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <p className="mt-16 text-center type-body text-slate-500">
          Nothing to stack yet — try adjusting your filters.
        </p>
      )}
    </div>
  );
}
