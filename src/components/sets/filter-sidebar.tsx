"use client";

import { useEffect } from "react";
import { X, RotateCcw } from "lucide-react";
import type { LegoTheme, Scenario } from "@/lib/types/lego";
import { LEGO_THEMES } from "@/lib/data/lego-themes";
import { cn } from "@/lib/utils";
import { SortControls } from "./sort-controls";
import type {
  FilterState,
  RecommendationFilter,
  StatusFilter,
} from "@/lib/domain/lego-filter";

interface FilterSidebarProps {
  state: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  isDefault: boolean;
  /** map: theme name -> count from current pre-theme result set */
  themeCounts: Record<string, number>;
  /** mobile overlay open/close */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "retiring", label: "Retiring soon" },
  { value: "retired", label: "Retired" },
];

const RECOMMENDATION_OPTIONS: { value: RecommendationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "buy", label: "Buy" },
  { value: "hold", label: "Hold" },
  { value: "sell", label: "Sell" },
];

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = [
  { value: "pessimist", label: "Pessimist" },
  { value: "moderate", label: "Moderate" },
  { value: "optimist", label: "Optimist" },
];

function Radio<T extends string>({
  name,
  value,
  current,
  label,
  onSelect,
}: {
  name: string;
  value: T;
  current: T;
  label: string;
  onSelect: (v: T) => void;
}) {
  const active = current === value;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-card px-2 py-1 type-body-sm text-jet-black hover:bg-slate-100",
        active && "bg-slate-100"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={() => onSelect(value)}
        className="h-4 w-4 cursor-pointer accent-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
      />
      <span>{label}</span>
    </label>
  );
}

export function FilterSidebar({
  state,
  onChange,
  onReset,
  isDefault,
  themeCounts,
  mobileOpen,
  onMobileClose,
}: FilterSidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  const toggleTheme = (t: LegoTheme) => {
    const has = state.themes.includes(t);
    onChange({
      ...state,
      themes: has ? state.themes.filter((x) => x !== t) : [...state.themes, t],
    });
  };

  const setStatus = (status: StatusFilter) => onChange({ ...state, status });
  const setRecommendation = (recommendation: RecommendationFilter) =>
    onChange({ ...state, recommendation });
  const setScenario = (scenario: Scenario) => onChange({ ...state, scenario });
  const setSort = (sort: FilterState["sort"]) => onChange({ ...state, sort });

  const content = (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="type-eyebrow text-slate-500">Filters</h2>
        <div className="flex items-center gap-1">
          {!isDefault && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset all filters"
              className="inline-flex items-center gap-1 rounded-chip border border-jet-black px-2 py-0.5 type-eyebrow text-jet-black hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close filters"
            className="md:hidden rounded-full p-1 text-slate-500 hover:text-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Theme */}
      <fieldset className="space-y-1">
        <legend className="type-eyebrow text-slate-500 mb-1">Theme</legend>
        <div className="max-h-72 overflow-y-auto pr-1">
          {LEGO_THEMES.map((meta) => {
            const count = themeCounts[meta.name] ?? 0;
            const checked = state.themes.includes(meta.name);
            const dim = count === 0 && !checked;
            return (
              <label
                key={meta.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-card px-2 py-1 type-body-sm hover:bg-slate-100",
                  dim && "opacity-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTheme(meta.name)}
                    className="h-4 w-4 cursor-pointer accent-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
                  />
                  <span className="text-jet-black">{meta.name}</span>
                </span>
                <span className="type-mono-num text-slate-500">({count})</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Status */}
      <fieldset className="space-y-1">
        <legend className="type-eyebrow text-slate-500 mb-1">Status</legend>
        {STATUS_OPTIONS.map((o) => (
          <Radio
            key={o.value}
            name="status"
            value={o.value}
            current={state.status}
            label={o.label}
            onSelect={setStatus}
          />
        ))}
      </fieldset>

      {/* Recommendation */}
      <fieldset className="space-y-1">
        <legend className="type-eyebrow text-slate-500 mb-1">Recommendation</legend>
        {RECOMMENDATION_OPTIONS.map((o) => (
          <Radio
            key={o.value}
            name="recommendation"
            value={o.value}
            current={state.recommendation}
            label={o.label}
            onSelect={setRecommendation}
          />
        ))}
      </fieldset>

      {/* Scenario */}
      <fieldset className="space-y-1">
        <legend className="type-eyebrow text-slate-500 mb-1">Scenario</legend>
        {SCENARIO_OPTIONS.map((o) => (
          <Radio
            key={o.value}
            name="scenario"
            value={o.value}
            current={state.scenario}
            label={o.label}
            onSelect={setScenario}
          />
        ))}
      </fieldset>

      {/* Sort */}
      <SortControls value={state.sort} onChange={setSort} />
    </div>
  );

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside
        aria-label="Filters"
        className="hidden md:block md:w-64 md:flex-shrink-0"
      >
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border-2 border-jet-black bg-pure-white p-4 shadow-sm">
          {content}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close filter overlay"
            onClick={onMobileClose}
            className="absolute inset-0 bg-jet-black/50"
          />
          <aside
            aria-label="Filters"
            className="absolute left-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-pure-white p-4 shadow-xl"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
