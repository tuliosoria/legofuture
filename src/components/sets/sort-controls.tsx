"use client";

import { cn } from "@/lib/utils";
import type { SortKey } from "@/lib/domain/lego-filter";

interface SortControlsProps {
  value: SortKey;
  onChange: (next: SortKey) => void;
}

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "gain", label: "Dollar gain ↓" },
  { value: "upside", label: "ROI % ↓" },
  { value: "price-desc", label: "Price ↓" },
  { value: "price-asc", label: "Price ↑" },
  { value: "confidence", label: "Confidence" },
  { value: "pieces-desc", label: "Pieces ↓" },
  { value: "pieces-asc", label: "Pieces ↑" },
  { value: "retirement", label: "Retirement year" },
];

export function SortControls({ value, onChange }: SortControlsProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="type-eyebrow text-slate-500">Sort by</legend>
      <div role="radiogroup" aria-label="Sort by" className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "inline-flex items-center rounded-chip border-2 border-jet-black px-3 py-1 type-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue",
                active
                  ? "bg-jet-black text-pure-white"
                  : "bg-pure-white text-jet-black hover:bg-slate-100"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
