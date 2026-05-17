import Link from "next/link";
import Image from "next/image";
import type { LegoSet, Forecast } from "@/lib/types/lego";

interface TopBuyItem {
  product: LegoSet;
  forecast: Forecast;
}

interface TopBuyOpportunitiesProps {
  items: TopBuyItem[];
}

export function TopBuyOpportunities({ items }: TopBuyOpportunitiesProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">🏆 Top Buy Opportunities</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map(({ product, forecast }) => (
          <Link
            key={product.id}
            href={`/set-forecast/${product.slug}`}
            className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-all hover:border-[hsl(var(--lego-yellow))]/60"
          >
            <div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-white">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-contain p-2 transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 45vw, 20vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  —
                </div>
              )}
            </div>
            <p className="text-xs font-semibold leading-tight line-clamp-2">{product.name}</p>
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              {product.theme}
            </p>
            <p className="mt-1.5 text-sm font-bold text-emerald-400">
              +{forecast.roiPercent.toFixed(1)}% 5y
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
