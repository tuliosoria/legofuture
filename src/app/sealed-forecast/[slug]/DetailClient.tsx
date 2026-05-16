"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SealedProduct, Forecast } from "@/lib/types/sealed";
import { SignalBadge, ConfidenceBadge } from "@/components/sealed/SignalBadge";
import { ForecastChart } from "@/components/sealed/ForecastChart";
import { RoiChart } from "@/components/sealed/RoiChart";
import { ForecastBreakdownModal } from "@/components/sealed/ForecastBreakdownModal";
import { bricklinkUrlForSetNumber } from "@/lib/domain/sealed-bricklink";
import { ExternalLink } from "lucide-react";

interface DetailClientProps {
  product: SealedProduct;
  forecast: Forecast;
}

export function DetailClient({ product, forecast }: DetailClientProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const bricklinkUrl = bricklinkUrlForSetNumber(product.setNumber);

  const statCard = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
      {sub && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{sub}</p>}
    </div>
  );

  return (
    <>
      {showBreakdown && (
        <ForecastBreakdownModal
          product={product}
          forecast={forecast}
          onClose={() => setShowBreakdown(false)}
        />
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        {/* Left: image + meta */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-white">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-contain p-6"
                sizes="(max-width: 1024px) 100vw, 33vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No image
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <SignalBadge signal={forecast.signal} />
            <ConfidenceBadge confidence={forecast.confidence} />
          </div>

          <dl className="space-y-2 text-sm">
            {[
              ["Set Number", product.setNumber],
              ["Theme", product.theme],
              ...(product.subtheme ? [["Subtheme", product.subtheme]] : []),
              ["Release Year", String(product.releaseYear)],
              ["Status", product.retired ? "Retired ✓" : "In Production"],
              ["Pieces", product.pieceCount.toLocaleString()],
              ["Minifigures", String(product.minifigCount)],
              ["Original MSRP", `$${product.originalMsrp.toLocaleString()}`],
            ]
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-[hsl(var(--border))]/50 pb-1.5">
                  <dt className="text-[hsl(var(--muted-foreground))]">{k}</dt>
                  <dd className="font-medium text-right">{v}</dd>
                </div>
              ))}
          </dl>

          <a
            href={bricklinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[hsl(var(--lego-yellow))]/60"
          >
            <ExternalLink className="h-4 w-4" />
            View on BrickLink
          </a>
        </div>

        {/* Right: forecast */}
        <div className="flex flex-col gap-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCard("Current Price", `$${forecast.currentPrice.toLocaleString()}`)}
            {statCard("5y Projected", `$${forecast.projectedValue.toLocaleString()}`)}
            {statCard(
              "5y ROI",
              `${forecast.roiPercent >= 0 ? "+" : ""}${forecast.roiPercent.toFixed(1)}%`,
              `${forecast.dollarGain >= 0 ? "+" : ""}$${forecast.dollarGain.toLocaleString()} gain`
            )}
            {statCard("Annual Rate", `${(forecast.annualRate * 100).toFixed(1)}%`, "CAGR")}
          </div>

          {/* Projection chart */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">5-Year Projection</h2>
              <button
                onClick={() => setShowBreakdown(true)}
                className="text-[11px] text-[hsl(var(--lego-yellow))] underline-offset-2 hover:underline"
              >
                See breakdown
              </button>
            </div>
            <ForecastChart forecast={forecast} />
          </div>

          {/* ROI comparison */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h2 className="mb-4 text-sm font-semibold">Scenario ROI vs S&P 500</h2>
            <RoiChart forecast={forecast} />
          </div>

          {/* Scenario table */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h2 className="mb-4 text-sm font-semibold">Scenario Outcomes</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  {["Scenario", "CAGR", "5y Value", "ROI"].map((h) => (
                    <th
                      key={h}
                      className="pb-2 text-left text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["pessimist", "moderate", "optimist"] as const).map((s) => {
                  const sc = forecast.scenarios[s];
                  return (
                    <tr key={s} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2.5 capitalize font-medium">{s}</td>
                      <td className="py-2.5">{(sc.annualRate * 100).toFixed(1)}%</td>
                      <td className="py-2.5">${sc.projectedValue.toLocaleString()}</td>
                      <td
                        className={`py-2.5 font-semibold ${
                          sc.roiPercent > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {sc.roiPercent >= 0 ? "+" : ""}
                        {sc.roiPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
            Projections are model estimates, not financial advice. LEGO set values are
            unpredictable. Past performance does not guarantee future results.{" "}
            <Link href="/sealed-forecast/methodology" className="underline hover:text-[hsl(var(--foreground))]">
              How it works →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
