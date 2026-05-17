"use client";

import { useState } from "react";
import type { LegoCondition } from "@/lib/types/lego";

export interface ConditionPricing {
  newSealed: number | null;
  complete: number | null;
  loose: number | null;
}

interface ConditionSelectorProps {
  pricing: ConditionPricing;
  defaultCondition?: LegoCondition;
}

const LABELS: Record<LegoCondition, string> = {
  "new-sealed": "New Sealed",
  complete: "Complete (CIB)",
  loose: "Loose",
};

const FIELDS: Record<LegoCondition, keyof ConditionPricing> = {
  "new-sealed": "newSealed",
  complete: "complete",
  loose: "loose",
};

const ORDER: LegoCondition[] = ["new-sealed", "complete", "loose"];

export function ConditionSelector({
  pricing,
  defaultCondition = "new-sealed",
}: ConditionSelectorProps) {
  const [condition, setCondition] = useState<LegoCondition>(defaultCondition);
  const price = pricing[FIELDS[condition]];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCondition(c)}
            className={`px-3 py-1.5 type-body-sm font-semibold border-2 border-jet-black rounded-md transition-colors ${
              c === condition
                ? "bg-jet-black text-pure-white"
                : "bg-pure-white text-jet-black hover:bg-paper"
            }`}
            aria-pressed={c === condition}
          >
            {LABELS[c]}
          </button>
        ))}
      </div>
      <div>
        <p className="type-eyebrow opacity-70 mb-0.5">{LABELS[condition]} price</p>
        <p className="type-mono-num text-2xl font-bold">
          {price !== null && price !== undefined ? (
            `$${price.toLocaleString()}`
          ) : (
            <span className="type-body-sm font-medium opacity-80">
              Price unavailable — sync pending
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
