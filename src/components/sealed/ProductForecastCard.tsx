import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SealedProduct, Forecast } from "@/lib/types/sealed";
import { deriveRecommendation } from "@/lib/domain/recommendation";

interface ProductForecastCardProps {
  product: SealedProduct;
  forecast: Forecast;
}

function trendIcon(roi: number) {
  if (roi > 5) return <TrendingUp className="h-4 w-4" aria-hidden />;
  if (roi < -5) return <TrendingDown className="h-4 w-4" aria-hidden />;
  return <Minus className="h-4 w-4" aria-hidden />;
}

function trendColor(roi: number) {
  if (roi > 5) return "text-emerald-400";
  if (roi < -5) return "text-rose-400";
  return "text-zinc-400";
}

const recommendationStyle: Record<string, string> = {
  buy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hold: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sell: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export function ProductForecastCard({ product, forecast }: ProductForecastCardProps) {
  const recommendation = deriveRecommendation({
    annualRate: forecast.annualRate,
    confidence: forecast.confidence,
    releaseYear: product.releaseYear,
    retired: product.retired,
  });

  const roi = forecast.roiPercent;
  const dollarGain = forecast.dollarGain;
  const colorClass = trendColor(roi);

  return (
    <Link
      href={`/sealed-forecast/${product.slug}`}
      aria-label={`View forecast for ${product.name}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all hover:border-[hsl(var(--lego-yellow))]/60 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
        <span
          className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${recommendationStyle[recommendation] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"}`}
        >
          {recommendation.charAt(0).toUpperCase() + recommendation.slice(1)}
        </span>
        {product.retired && (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-700/80 px-2 py-0.5 text-[9px] font-semibold text-zinc-300">
            Retired
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">
            {product.name}
          </h3>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {product.theme} · {product.releaseYear}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Now</p>
            <p className="font-semibold">${forecast.currentPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">5y Projected</p>
            <p className="font-semibold">${forecast.projectedValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">ROI</p>
            <p className={`flex items-center gap-1 font-semibold ${colorClass}`}>
              {trendIcon(roi)}
              {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Gain</p>
            <p className={`font-semibold ${colorClass}`}>
              {dollarGain >= 0 ? "+" : ""}${dollarGain.toLocaleString()}
            </p>
          </div>
        </div>

        <span className="mt-1 inline-flex items-center justify-center rounded-md border border-[hsl(var(--lego-yellow))]/40 bg-[hsl(var(--lego-yellow))]/10 px-2 py-1 text-[11px] font-semibold text-[hsl(var(--lego-yellow))] transition-colors group-hover:bg-[hsl(var(--lego-yellow))]/20">
          View Forecast →
        </span>
      </div>
    </Link>
  );
}
