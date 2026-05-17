import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LegoSet, Forecast } from "@/lib/types/lego";
import { deriveRecommendation } from "@/lib/domain/recommendation";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import type { ComponentProps } from "react";

type AccentColor = ComponentProps<typeof BrickCard>["accentTop"];

interface ProductForecastCardProps {
  product: LegoSet;
  forecast: Forecast;
}

function trendIcon(roi: number) {
  if (roi > 5) return <TrendingUp className="h-4 w-4" aria-hidden strokeWidth={1.75} />;
  if (roi < -5) return <TrendingDown className="h-4 w-4" aria-hidden strokeWidth={1.75} />;
  return <Minus className="h-4 w-4" aria-hidden strokeWidth={1.75} />;
}

function roiColor(roi: number): string {
  if (roi > 5) return "text-pure-green";
  if (roi < -5) return "text-brick-red";
  return "text-slate-500";
}

const signalToAccent: Record<string, AccentColor> = {
  Buy: "blue",
  Hold: "yellow",
  Sell: "black",
};

export function ProductForecastCard({ product, forecast }: ProductForecastCardProps) {
  const recommendation = deriveRecommendation({
    annualRate: forecast.annualRate,
    confidence: forecast.confidence,
    releaseYear: product.releaseYear,
    retired: product.retired,
  });

  const accentTop = signalToAccent[forecast.signal] ?? "black";
  const roi = forecast.roiPercent;
  const dollarGain = forecast.dollarGain;

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
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: "Now", value: `$${forecast.currentPrice.toLocaleString()}` },
            { label: "5y Proj.", value: `$${forecast.projectedValue.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="type-eyebrow text-slate-500">{label}</p>
              <p className="type-mono-num text-jet-black">{value}</p>
            </div>
          ))}
          <div>
            <p className="type-eyebrow text-slate-500">ROI</p>
            <p className={`type-mono-num flex items-center gap-0.5 ${roiColor(roi)}`}>
              {trendIcon(roi)}
              {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="type-eyebrow text-slate-500">Gain</p>
            <p className={`type-mono-num ${roiColor(roi)}`}>
              {dollarGain >= 0 ? "+" : ""}${dollarGain.toLocaleString()}
            </p>
          </div>
        </div>

        <BrickButton variant="ghost" size="sm" className="w-full justify-center text-jet-black">
          View Forecast →
        </BrickButton>
      </BrickCard>
    </Link>
  );
}
