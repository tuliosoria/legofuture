"use client";

import { useState, useId } from "react";

interface Props {
  label: string;
  children: React.ReactNode;
}

/**
 * Small "ⓘ" icon with a hover/focus tooltip. Accessible (keyboard-focusable
 * button, `aria-describedby` linkage, dismiss on Escape) and dependency-free.
 */
export function InfoTooltip({ label, children }: Props) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={`More about ${label}`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-500 hover:bg-slate-100 hover:text-jet-black focus:outline-none focus-visible:ring-2 focus-visible:ring-bright-blue"
      >
        i
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-pure-white px-3 py-2 text-left type-caption leading-snug text-slate-700 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
