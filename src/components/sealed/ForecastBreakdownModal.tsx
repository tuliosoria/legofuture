"use client";

import { X } from "lucide-react";
import type { Forecast, SealedProduct } from "@/lib/types/sealed";
import { buildForecastBreakdown } from "@/lib/domain/forecast-breakdown";

interface ForecastBreakdownModalProps {
  product: SealedProduct;
  forecast: Forecast;
  onClose: () => void;
}

export function ForecastBreakdownModal({
  product,
  forecast,
  onClose,
}: ForecastBreakdownModalProps) {
  const breakdown = buildForecastBreakdown(product, forecast);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-[hsl(var(--muted))]"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-lg font-bold">{product.name}</h2>
        <p className="mb-5 text-xs text-[hsl(var(--muted-foreground))]">Forecast Breakdown</p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="pb-2 text-left text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                Factor
              </th>
              <th className="pb-2 text-right text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row, i) => (
              <tr key={i} className="border-b border-[hsl(var(--border))]/50">
                <td className="py-2.5 pr-4">
                  <p>{row.label}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{row.description}</p>
                </td>
                <td
                  className={`py-2.5 text-right font-semibold ${
                    row.impact === "positive"
                      ? "text-emerald-400"
                      : row.impact === "negative"
                      ? "text-rose-400"
                      : "text-zinc-400"
                  }`}
                >
                  {row.value}
                </td>
              </tr>
            ))}
            <tr>
              <td className="pt-3 font-semibold">Modeled Annual Rate</td>
              <td className="pt-3 text-right font-mono font-bold text-[hsl(var(--lego-yellow))]">
                {(forecast.annualRate * 100).toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-5 text-[11px] text-[hsl(var(--muted-foreground))]">
          Projections are model estimates, not guarantees. Past performance does not guarantee
          future results.
        </p>
      </div>
    </div>
  );
}
