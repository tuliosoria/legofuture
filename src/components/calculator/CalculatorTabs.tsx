"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FlipCalculator } from "./FlipCalculator";
import { RetirementCalculator } from "./RetirementCalculator";
import { HoldCalculator } from "./HoldCalculator";

type TabId = "flip" | "retirement" | "hold";

const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: "flip", label: "Flip", sub: "Sell-now profit" },
  { id: "retirement", label: "Retirement", sub: "Project at horizon" },
  { id: "hold", label: "Hold", sub: "Already own it" },
];

export function CalculatorTabs() {
  const [active, setActive] = useState<TabId>("flip");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Calculator type">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={cn(
                "px-4 py-2 rounded-card border-2 type-body-sm font-medium transition-colors",
                isActive
                  ? "bg-jet-black text-bright-yellow border-jet-black"
                  : "bg-pure-white text-jet-black border-jet-black hover:bg-slate-100"
              )}
            >
              <span>{t.label}</span>
              <span className="ml-2 text-xs opacity-70 hidden sm:inline">{t.sub}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "flip" && <FlipCalculator />}
        {active === "retirement" && <RetirementCalculator />}
        {active === "hold" && <HoldCalculator />}
      </div>
    </div>
  );
}
