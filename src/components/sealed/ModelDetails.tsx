import type { Forecast, SealedProduct } from "@/lib/types/sealed";
import { buildKeyDrivers } from "@/lib/domain/key-drivers";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ModelDetailsProps {
  product: SealedProduct;
  forecast: Forecast;
}

const iconForImpact = (impact: "positive" | "neutral" | "negative") => {
  if (impact === "positive") return <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden />;
  if (impact === "negative") return <TrendingDown className="h-4 w-4 text-rose-400" aria-hidden />;
  return <Minus className="h-4 w-4 text-zinc-400" aria-hidden />;
};

export function ModelDetails({ product, forecast }: ModelDetailsProps) {
  const drivers = buildKeyDrivers(product, forecast);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        Key Model Drivers
      </h3>
      <ul className="flex flex-col gap-3">
        {drivers.map((driver, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5">{iconForImpact(driver.impact)}</span>
            <div>
              <p className="text-sm font-medium leading-snug">{driver.label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{driver.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
