"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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

const PAGE_LIMIT = 60;

interface CatalogApiResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface ForecastDashboardProps {
  /** SSR-rendered first page of items (fast first paint). */
  initialItems: CatalogItem[];
  /** Total catalog count from the SSR scan (may update once API responds). */
  initialTotal: number;
  includeOrphans?: boolean;
  /** @internal Test helper: shows Load-more button regardless of sentinel */
  _testForceLoadMore?: boolean;
}

/** Build query string for the catalog API */
function buildCatalogUrl(page: number, state: FilterState, includeOrphans: boolean): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("limit", String(PAGE_LIMIT));
  if (state.query) sp.set("q", state.query);
  if (state.themes.length === 1) sp.set("theme", state.themes[0]);
  if (state.status !== "all") sp.set("status", state.status);
  if (includeOrphans) sp.set("includeOrphans", "1");
  return `/api/sets/catalog?${sp.toString()}`;
}

export function ForecastDashboard({
  initialItems,
  initialTotal,
  includeOrphans = true,
  _testForceLoadMore = false,
}: ForecastDashboardProps) {
  const [state, setState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Pagination state
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotal);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadedForState = useRef<FilterState>(DEFAULT_FILTER_STATE);

  // sentinel ref for IntersectionObserver infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  /** Fetch a page from the API; append=true appends, false replaces */
  const fetchPage = useCallback(
    async (targetPage: number, filterState: FilterState, append: boolean) => {
      setIsLoadingMore(true);
      try {
        const url = buildCatalogUrl(targetPage, filterState, includeOrphans);
        const res = await fetch(url);
        if (!res.ok) return;
        const data: CatalogApiResponse = await res.json();
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setTotal(data.total);
        setPage(data.page);
        setHasMore(data.hasMore);
        loadedForState.current = filterState;
      } finally {
        setIsLoadingMore(false);
      }
    },
    [includeOrphans]
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    fetchPage(page + 1, state, true);
  }, [fetchPage, hasMore, isLoadingMore, page, state]);

  // IntersectionObserver: trigger next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const updateState = useCallback(
    (next: FilterState) => {
      startTransition(() => {
        setState(next);
        // Server-filter-relevant changes: reset items and fetch fresh page 1
        const serverFiltersChanged =
          next.query !== loadedForState.current.query ||
          next.status !== loadedForState.current.status ||
          JSON.stringify(next.themes) !== JSON.stringify(loadedForState.current.themes);
        if (serverFiltersChanged) {
          setItems([]);
          setTotal(0);
          setPage(0);
          setHasMore(false);
          fetchPage(1, next, false);
        }
      });
    },
    [fetchPage]
  );

  const reset = useCallback(() => {
    startTransition(() => {
      setState(DEFAULT_FILTER_STATE);
      setItems(initialItems);
      setTotal(initialTotal);
      setPage(1);
      setHasMore(initialItems.length < initialTotal);
      loadedForState.current = DEFAULT_FILTER_STATE;
    });
  }, [initialItems, initialTotal]);

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
        {/* "X of Y sets" counter */}
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
          {/* Sticky toolbar: search + result count + mobile filters trigger */}
          <div className="sticky top-14 z-30 -mx-4 md:mx-0 mb-4 border-b-2 border-jet-black/10 bg-paper/95 px-4 md:px-0 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
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
            {/* Showing X of Y sets · show-all toggle (URL preserved across pages) */}
            <p className="mt-2 type-body-sm text-slate-500" aria-live="polite">
              Showing{" "}
              <span className="type-mono-num text-jet-black">{matched}</span>{" "}
              of{" "}
              <span className="type-mono-num text-jet-black">{total.toLocaleString()}</span>{" "}
              sets
              {" · "}
              <a
                href={
                  includeOrphans
                    ? "/set-forecast?pricingOnly=1"
                    : "/set-forecast"
                }
                className="underline text-slate-600 hover:text-jet-black"
              >
                {includeOrphans
                  ? "Show only sets with pricing data"
                  : "Show all sets"}
              </a>
            </p>
          </div>

          {isPending && matched === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonForecastCard key={i} />
              ))}
            </div>
          ) : matched === 0 && !isLoadingMore ? (
            <div className="rounded-card border-2 border-dashed border-jet-black/40 bg-pure-white p-10 text-center">
              <p className="type-body text-slate-600">No sets match these filters.</p>
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
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {pipeline.results.map(({ product, forecast }) => (
                  <ProductForecastCard
                    key={product.id}
                    product={product}
                    forecast={renderForecast(forecast, state.scenario)}
                  />
                ))}
              </div>

              {/* Infinite-scroll sentinel — IntersectionObserver watches this div */}
              <div ref={sentinelRef} className="h-4" aria-hidden />

              {/* Loading skeletons while fetching next page */}
              {isLoadingMore && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 mt-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonForecastCard key={`skeleton-more-${i}`} />
                  ))}
                </div>
              )}

              {/* Explicit load-more button as fallback + accessible alternative */}
              {hasMore && !isLoadingMore && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    data-testid="load-more-btn"
                    onClick={loadMore}
                    className="inline-flex rounded-card border-2 border-jet-black bg-pure-white px-6 py-2 type-body-sm text-jet-black hover:bg-sunshine-yellow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
                  >
                    Load more sets
                  </button>
                </div>
              )}
            </>
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
