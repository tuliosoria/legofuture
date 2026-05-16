"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { SealedProduct, Forecast, LegoTheme, Scenario } from "@/lib/types/sealed";
import { ProductForecastCard } from "./ProductForecastCard";
import { SkeletonForecastCard } from "./SkeletonForecastCard";
import { TopBuyOpportunities } from "./TopBuyOpportunities";

interface CatalogItem {
  product: SealedProduct;
  forecast: Forecast;
}

interface ForecastDashboardProps {
  items: CatalogItem[];
  loading?: boolean;
}

const ALL_THEMES: LegoTheme[] = [
  "Icons",
  "Star Wars",
  "Harry Potter",
  "Technic",
  "Ideas",
  "Modular Buildings",
  "Architecture",
  "Marvel",
  "Friends",
  "GWP",
  "Other",
];

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "moderate", label: "Moderate" },
  { value: "pessimist", label: "Pessimist" },
  { value: "optimist", label: "Optimist" },
];

const SORT_OPTIONS = [
  { value: "roi", label: "Highest ROI" },
  { value: "price", label: "Highest Value" },
  { value: "signal", label: "Growth Rate" },
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
        case "price":
          return fb.projectedValue - fa.projectedValue;
        case "signal":
          return fb.annualRate - fa.annualRate;
        case "roi":
        default:
          return fb.roiPercent - fa.roiPercent;
      }
    });

    return out;
  }, [items, query, theme, statusFilter, signal, scenario, sort]);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10">
      {/* Top Buys */}
      {!loading && topBuys.length > 0 && (
        <div className="mb-10">
          <TopBuyOpportunities items={topBuys} />
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets…"
            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-2 pl-9 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--lego-yellow))]/60"
          />
        </div>

        {/* Theme select */}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as LegoTheme | "")}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Themes</option>
          {ALL_THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "retired" | "current")}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="retired">Retired</option>
          <option value="current">In Production</option>
        </select>

        {/* Signal filter */}
        <select
          value={signal}
          onChange={(e) => setSignal(e.target.value as "" | "Buy" | "Hold" | "Sell")}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Signals</option>
          <option value="Buy">Buy</option>
          <option value="Hold">Hold</option>
          <option value="Sell">Sell</option>
        </select>

        {/* Scenario */}
        <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          {SCENARIOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setScenario(value)}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                scenario === value
                  ? "bg-[hsl(var(--lego-yellow))]/20 text-[hsl(var(--lego-yellow))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
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
        <p className="mt-16 text-center text-[hsl(var(--muted-foreground))]">
          No sets match your filters.
        </p>
      )}
    </div>
  );
}
