"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "legofuture:disclaimer-dismissed";

export function FirstVisitDisclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!dismissed) setVisible(true);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Disclaimer"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl rounded-lg border-l-4 border-yellow-400 bg-slate-900/95 text-slate-100 shadow-xl backdrop-blur px-4 py-3 pointer-events-auto flex items-start gap-3">
        <p className="text-sm leading-snug flex-1">
          <strong className="font-semibold">
            LegoFuture is informational only and not financial advice.
          </strong>{" "}
          Forecasts are model estimates based on historical PriceCharting data
          and community signals. They are not guarantees. Verify all prices before
          buying or selling.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-yellow-300 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
