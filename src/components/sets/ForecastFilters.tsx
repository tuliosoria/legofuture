"use client";

import { useMemo, useState } from "react";
import { SetCard } from "./SetCard";
import type { LegoSet, LegoSetSignal, LegoSetStatus } from "@/lib/domain/lego-set";
import { roiPercent } from "@/lib/domain/forecast";

type SortKey = "score" | "roi" | "price-asc" | "price-desc" | "year-desc";

interface Props {
  sets: LegoSet[];
}

const SIGNALS: LegoSetSignal[] = ["Strong Buy", "Buy", "Watch", "Hold", "Sell"];
const STATUSES: LegoSetStatus[] = ["Active", "Retiring soon", "Retired"];

export function ForecastFilters({ sets }: Props) {
  const themes = useMemo(
    () => Array.from(new Set(sets.map((s) => s.theme))).sort(),
    [sets],
  );

  const [theme, setTheme] = useState<string>("All");
  const [signal, setSignal] = useState<LegoSetSignal | "All">("All");
  const [status, setStatus] = useState<LegoSetStatus | "All">("All");
  const [sort, setSort] = useState<SortKey>("score");

  const filtered = useMemo(() => {
    const out = sets.filter(
      (s) =>
        (theme === "All" || s.theme === theme) &&
        (signal === "All" || s.signal === signal) &&
        (status === "All" || s.status === status),
    );
    out.sort((a, b) => {
      switch (sort) {
        case "score":
          return b.score - a.score;
        case "roi":
          return roiPercent(b) - roiPercent(a);
        case "price-asc":
          return a.currentPrice - b.currentPrice;
        case "price-desc":
          return b.currentPrice - a.currentPrice;
        case "year-desc":
          return b.year - a.year;
      }
    });
    return out;
  }, [sets, theme, signal, status, sort]);

  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 md:mx-0 mb-6 bg-paper/95 backdrop-blur border-y-2 border-jet-black px-4 md:px-0 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="Theme" value={theme} onChange={setTheme} options={["All", ...themes]} />
          <FilterSelect
            label="Signal"
            value={signal}
            onChange={(v) => setSignal(v as LegoSetSignal | "All")}
            options={["All", ...SIGNALS]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as LegoSetStatus | "All")}
            options={["All", ...STATUSES]}
          />
          <FilterSelect
            label="Sort by"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: "score", label: "Score (high → low)" },
              { value: "roi", label: "5yr ROI (high → low)" },
              { value: "price-asc", label: "Price (low → high)" },
              { value: "price-desc", label: "Price (high → low)" },
              { value: "year-desc", label: "Year (newest)" },
            ]}
          />
          <p className="ml-auto type-body-sm text-slate-500">
            <strong className="text-jet-black">{filtered.length}</strong> of {sets.length} sets
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="type-body text-slate-500 py-12 text-center">No sets match those filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <SetCard key={s.id} set={s} />
          ))}
        </div>
      )}
    </div>
  );
}

type Opt = string | { value: string; label: string };

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}

function FilterSelect({ label, value, onChange, options }: SelectProps) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="type-caption text-slate-500 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-chip border-2 border-jet-black bg-pure-white px-3 py-1.5 type-body-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue"
      >
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const lbl = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}
