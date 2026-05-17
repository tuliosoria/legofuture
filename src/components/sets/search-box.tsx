"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { LegoTheme } from "@/lib/types/lego";

interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
  resultCount: number;
  aliasTheme?: LegoTheme;
  aliasStatus?: "active" | "retiring" | "retired";
  onPinAliasTheme?: (theme: LegoTheme) => void;
  debounceMs?: number;
}

export function SearchBox({
  value,
  onChange,
  resultCount,
  aliasTheme,
  aliasStatus,
  onPinAliasTheme,
  debounceMs = 200,
}: SearchBoxProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    // Sync local input when parent resets `value` (e.g., Reset Filters).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
  }, [local, value, onChange, debounceMs]);

  return (
    <div className="w-full">
      <label htmlFor="set-search" className="sr-only">
        Search sets
      </label>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            id="set-search"
            type="search"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder={`Search by name, set number, theme, or status (e.g. "star wars retiring")`}
            className="w-full h-11 rounded-card border-2 border-jet-black bg-pure-white pl-9 pr-10 type-body-sm text-jet-black placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
            aria-describedby="set-search-count"
          />
          {local && (
            <button
              type="button"
              onClick={() => {
                setLocal("");
                onChange("");
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:text-jet-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        <p
          id="set-search-count"
          className="type-body-sm text-slate-600 md:whitespace-nowrap"
          aria-live="polite"
        >
          {resultCount} result{resultCount === 1 ? "" : "s"}
        </p>
      </div>

      {(aliasTheme || aliasStatus) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 type-body-sm text-slate-600">
          <span>Did you mean:</span>
          {aliasTheme && (
            <button
              type="button"
              onClick={() => onPinAliasTheme?.(aliasTheme)}
              aria-label={`Pin ${aliasTheme} theme filter`}
              className="inline-flex items-center gap-1 rounded-chip border-2 border-jet-black bg-sunshine-yellow px-2 py-0.5 type-eyebrow text-jet-black hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
            >
              {aliasTheme}
            </button>
          )}
          {aliasStatus && (
            <span className="inline-flex items-center gap-1 rounded-chip border-2 border-jet-black bg-slate-200 px-2 py-0.5 type-eyebrow text-jet-black">
              {aliasStatus === "active"
                ? "Active"
                : aliasStatus === "retiring"
                  ? "Retiring soon"
                  : "Retired"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
