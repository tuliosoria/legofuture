"use client";

import type { SortKey } from "@/lib/domain/lego-filter";

interface SortMenuProps {
  value: SortKey;
  onChange: (next: SortKey) => void;
  /** When true, uses larger touch-friendly sizing for the toolbar. */
  compact?: boolean;
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "investmentScore", label: "Investment Score ↓" },
  { value: "gain", label: "Dollar gain (high → low)" },
  { value: "upside", label: "ROI % (high → low)" },
  { value: "price-desc", label: "Price (high → low)" },
  { value: "price-asc", label: "Price (low → high)" },
  { value: "confidence", label: "Data strength (strong → thin)" },
  { value: "pieces-desc", label: "Pieces (high → low)" },
  { value: "pieces-asc", label: "Pieces (low → high)" },
  { value: "retirement", label: "Retirement year (soonest)" },
];

/**
 * Compact sort dropdown for the dashboard toolbar. Pairs with the
 * chip-based <SortControls /> in the sidebar — both write to the same
 * filter-state field, so changing either keeps the two in sync.
 */
export function SortMenu({ value, onChange, compact = false }: SortMenuProps) {
  const height = compact ? "h-11" : "h-9";
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="dashboard-sort"
        className="type-eyebrow text-slate-500 whitespace-nowrap"
      >
        Sort by
      </label>
      <select
        id="dashboard-sort"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className={`${height} min-w-0 max-w-full rounded-card border-2 border-jet-black bg-pure-white px-3 type-body-sm text-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue`}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
