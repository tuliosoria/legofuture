import Link from "next/link";
import Image from "next/image";
import type { LegoSet, Forecast } from "@/lib/types/lego";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import type { ComponentProps } from "react";

type AccentColor = ComponentProps<typeof BrickCard>["accentTop"];

interface ProductForecastCardProps {
  product: LegoSet;
  forecast: Forecast;
}

function scoreColor(score?: number): string {
  if (!score) return "text-slate-400";
  if (score >= 80) return "text-pure-green";
  if (score >= 60) return "text-sunshine-yellow";
  return "text-slate-500";
}

const SIGNAL_CHIP: Record<string, string> = {
  "Strong Buy": "bg-pure-green text-jet-black",
  "Buy": "bg-bright-blue text-pure-white",
  "Watch": "bg-sunshine-yellow text-jet-black",
  "Avoid": "bg-slate-200 text-slate-700",
  "DataIssue": "bg-brick-red text-pure-white",
};

function ScreenerSignalChip({ signal }: { signal?: string }) {
  if (!signal || signal === "DataIssue") return null;
  return (
    <span className={`inline-flex items-center rounded-chip px-2 py-0.5 type-eyebrow ${SIGNAL_CHIP[signal] ?? SIGNAL_CHIP["Avoid"]}`}>
      {signal}
    </span>
  );
}

const screenerSignalToAccent: Record<string, AccentColor> = {
  "Strong Buy": "blue",
  "Buy": "blue",
  "Watch": "yellow",
  "Avoid": "black",
  "DataIssue": "black",
};

export function ProductForecastCard({ product, forecast }: ProductForecastCardProps) {
  const isEstimated = forecast.priceSource === "estimated";
  const noPricing = forecast.currentPrice <= 0;
  const accentTop: AccentColor = noPricing
    ? "black"
    : (screenerSignalToAccent[forecast.screenerSignal ?? ""] ?? "black");

  return (
    <Link
      href={`/set-forecast/${product.slug}`}
      aria-label={`View forecast for ${product.name}`}
      className="group block"
    >
      <BrickCard
        as="article"
        accentTop={accentTop}
        studStrip
        compact
        className="h-full flex flex-col gap-0 transition-all duration-[120ms] group-hover:-translate-y-px group-hover:shadow-click-lg"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-slate-50 -mx-4 -mt-4 mb-4 border-b-2 border-jet-black">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-contain p-4 transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center type-body-sm text-slate-300">
              No image
            </div>
          )}
          {product.retired && (
            <span className="absolute left-2 top-2 bg-jet-black text-pure-white type-eyebrow px-2 py-0.5 rounded-chip">
              Retired
            </span>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 mb-3">
          <h3 className="type-body-sm font-medium text-jet-black leading-tight line-clamp-2 mb-1">
            {product.name}
          </h3>
          <p className="type-eyebrow text-slate-500">
            {product.theme} · {product.releaseYear}
          </p>
        </div>

        {/* Stats */}
        {noPricing ? (
          <div className="mb-3 rounded-sm border border-dashed border-jet-black/40 bg-slate-50 p-3 text-center">
            <p className="type-eyebrow text-slate-500">No pricing data yet</p>
            <p className="type-body-sm text-slate-600 mt-1">
              Catalog entry only — projections unavailable.
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-3">
            {/* Score + Signal */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="type-eyebrow text-slate-500">Score</p>
                <p className={`type-mono-num text-2xl font-bold leading-none ${scoreColor(forecast.investmentScore)}`}>
                  {forecast.investmentScore ?? "—"}
                </p>
              </div>
              <ScreenerSignalChip signal={forecast.screenerSignal} />
            </div>

            {/* Price row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="type-eyebrow text-slate-500 flex items-center gap-1">
                  Now
                  {isEstimated && (
                    <span
                      title="Estimated from piece count × theme median — no marketplace data yet"
                      className="bg-slate-200 text-slate-700 type-eyebrow px-1 py-px rounded-chip"
                    >
                      est
                    </span>
                  )}
                </p>
                <p className="type-mono-num text-jet-black">
                  ${forecast.currentPrice.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="type-eyebrow text-slate-500">Est. net gain</p>
                {forecast.estimatedNetGain != null ? (
                  <p className={`type-mono-num ${forecast.estimatedNetGain >= 0 ? "text-pure-green" : "text-brick-red"}`}>
                    {forecast.estimatedNetGain >= 0 ? "+" : ""}${Math.round(forecast.estimatedNetGain).toLocaleString()}
                  </p>
                ) : (
                  <p className="type-mono-num text-slate-400">—</p>
                )}
              </div>
            </div>

            {/* Liquidity */}
            {forecast.liquidityScore && forecast.liquidityScore !== "Insufficient" && (
              <p className="type-eyebrow text-slate-500">
                Liquidity:{" "}
                <span className={
                  forecast.liquidityScore === "High" ? "text-pure-green" :
                  forecast.liquidityScore === "Medium" ? "text-bright-blue" :
                  "text-sunshine-yellow"
                }>
                  {forecast.liquidityScore}
                </span>
              </p>
            )}

            {/* Signal explainer bullets (Buy / Strong Buy only) */}
            {(forecast.screenerSignal === "Buy" || forecast.screenerSignal === "Strong Buy") &&
              forecast.signalExplainer?.slice(0, 2).map((line, i) => (
                <p key={i} className="type-eyebrow text-slate-600">· {line}</p>
              ))}
          </div>
        )}

        <BrickButton variant="ghost" size="sm" className="w-full justify-center text-jet-black">
          View Forecast →
        </BrickButton>
      </BrickCard>
    </Link>
  );
}
