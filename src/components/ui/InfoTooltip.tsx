"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  label: string;
  children: React.ReactNode;
}

/**
 * Small "ⓘ" icon with a hover/focus tooltip. The popover renders into a
 * portal at <body> using fixed positioning so it can't be clipped by an
 * ancestor's `overflow: hidden` / `overflow: clip` (the typical "tooltip
 * hidden behind container" bug). Accessible: keyboard-focusable button,
 * `aria-describedby` linkage, dismiss on Escape.
 */
export function InfoTooltip({ label, children }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const tipId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount detection for portal target
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Anchor below + horizontally centered on the icon. The tooltip itself
    // is `-translate-x-1/2` so `left` is the center point.
    setCoords({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }, [open]);

  return (
    <span className="inline-flex items-center align-middle">
      <button
        ref={btnRef}
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
      {open && mounted && coords
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
              className="pointer-events-none fixed z-[1000] w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-pure-white px-3 py-2 text-left type-caption leading-snug text-slate-700 shadow-lg"
            >
              {children}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
