"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Forecast, LegoTheme } from "@/lib/types/lego";
import { LEGO_THEMES } from "@/lib/data/lego-themes";
import { ProductForecastCard } from "./ProductForecastCard";
import { SkeletonForecastCard } from "./SkeletonForecastCard";
import { TopBuyOpportunities } from "./TopBuyOpportunities";
import { FilterSidebar } from "./filter-sidebar";
import { SearchBox } from "./search-box";
import {
  DEFAULT_FILTER_STATE,
  isDefaultState,
  runFilterPipeline,
  type CatalogItem,
  type FilterState,
} from "@/lib/domain/lego-filter";

interface ForecastDashboardProps {
  items: CatalogItem[];
}

export function ForecastDashboard({ items }: ForecastDashboardProps) {
  const [state, setState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const updateState = useCallback((next: FilterState) => {
    startTransition(() => setState(next));
  }, []);

  const reset = useCallback(() => {
    startTransition(() => setState(DEFAULT_FILTER_STATE));
  }, []);

  const pipeline = useMemo(() => runFilterPipeline(items, state), [items, state]);

  const themeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const meta of LEGO_THEMES) counts[meta.name] = 0;
    for (const { product } of pipeline.preThemeResults) {
      counts[product.theme] = (counts[product.theme] ?? 0) + 1;
    }
    return counts;
  }, [pipeline.preThemeResults]);

  const topBuys = useMemo(
    () =>
      items
        .filter(({ forecast }) => forecast.signal === "Buy")
        .sort((a, b) => b.forecast.roiPercent - a.forecast.roiPercent)
        .slice(0, 5),
    [items]
  );

  const total = items.length;
  const matched = pipeline.results.length;
  const pinAliasTheme = (t: LegoTheme) =>
    updateState({
      ...state,
      themes: state.themes.includes(t) ? state.themes : [...state.themes, t],
      query: "",
    });

  return (
    <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
      <div className="mb-6">
        <p className="type-body-sm text-slate-600">
          <span className="type-mono-num text-jet-black">{total.toLocaleString()}</span>{" "}
          sets tracked
        </p>
      </div>

      {topBuys.length > 0 && (
        <div className="mb-10">
          <TopBuyOpportunities items={topBuys} />
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <FilterSidebar
          state={state}
          onChange={updateState}
          onReset={reset}
          isDefault={isDefaultState(state)}
          themeCounts={themeCounts}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
        />

        <section className="flex-1 min-w-0" aria-label="Set forecasts">
          {/* Sticky toolbar: search + result count + mobile filters trigger.
              Site header is h-14 (56px) sticky z-50, so this docks just below at top-14 z-30. */}
          <div className="sticky top-14 z-30 -mx-4 md:-mx-8 mb-4 border-b-2 border-jet-black/10 bg-paper/95 px-4 md:px-8 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <SearchBox
                  value={state.query}
                  onChange={(query) => updateState({ ...state, query })}
                  resultCount={matched}
                  aliasTheme={pipeline.aliases.theme}
                  aliasStatus={pipeline.aliases.status}
                  onPinAliasTheme={pinAliasTheme}
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                aria-label="Open filters"
                className="md:hidden inline-flex flex-shrink-0 items-center gap-2 rounded-card border-2 border-jet-black bg-pure-white px-3 h-11 type-body-sm text-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Filters
              </button>
            </div>
            <p className="mt-2 type-body-sm text-slate-500" aria-live="polite">
              Showing <span className="type-mono-num text-jet-black">{matched}</span>{" "}
              of <span className="type-mono-num text-jet-black">{total}</span> sets
            </p>
          </div>

          {isPending && matched === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonForecastCard key={i} />
              ))}
            </div>
          ) : matched === 0 ? (
            <div className="rounded-card border-2 border-dashed border-jet-black/40 bg-pure-white p-10 text-center">
              <p className="type-body text-slate-600">
                No sets match these filters.
              </p>
              {!isDefaultState(state) && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-3 inline-flex rounded-chip border-2 border-jet-black bg-sunshine-yellow px-3 py-1 type-body-sm text-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {pipeline.results.map(({ product, forecast }) => (
                <ProductForecastCard
                  key={product.id}
                  product={product}
                  forecast={renderForecast(forecast, state.scenario)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Project the chosen scenario's headline numbers onto the top-level
 * Forecast so the card displays the user-selected outlook.
 */
function renderForecast(
  forecast: Forecast,
  scenario: FilterState["scenario"]
): Forecast {
  const s = forecast.scenarios[scenario];
  if (!s) return forecast;
  return {
    ...forecast,
    projectedValue: s.projectedValue,
    dollarGain: s.dollarGain,
    roiPercent: s.roiPercent,
    annualRate: s.annualRate,
    signal: s.signal,
  };
}

export type { CatalogItem };
