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
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";

interface DetailClientProps {
  product: SealedProduct;
  forecast: Forecast;
}

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
}

function StatTile({ label, value, sub, positive, negative }: StatTileProps) {
  return (
    <BrickCard compact as="div">
      <p className="type-eyebrow text-slate-500 mb-1">{label}</p>
      <p className={`type-mono-num text-xl font-bold ${positive ? "text-pure-green" : negative ? "text-brick-red" : "text-jet-black"}`}>
        {value}
      </p>
      {sub && <p className="type-body-sm text-slate-500 mt-0.5">{sub}</p>}
    </BrickCard>
  );
}

export function DetailClient({ product, forecast }: DetailClientProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const bricklinkUrl = bricklinkUrlForSetNumber(product.setNumber);

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
          <div className="relative aspect-square overflow-hidden rounded-card border-2 border-jet-black bg-pure-white">
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
              <div className="flex h-full items-center justify-center type-body-sm text-slate-300">
                No image
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <SignalBadge signal={forecast.signal} />
            <ConfidenceBadge confidence={forecast.confidence} />
          </div>

          <dl className="space-y-2 type-body-sm">
            {([
              ["Set Number", product.setNumber],
              ["Theme", product.theme],
              ...(product.subtheme ? [["Subtheme", product.subtheme]] : []),
              ["Release Year", String(product.releaseYear)],
              ["Status", product.retired ? "Retired ✓" : "In Production"],
              ["Pieces", product.pieceCount.toLocaleString()],
              ["Minifigures", String(product.minifigCount)],
              ["Original MSRP", `$${product.originalMsrp.toLocaleString()}`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-jet-black text-right">{v}</dd>
              </div>
            ))}
          </dl>

          <a
            href={bricklinkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BrickButton variant="ghost" size="sm" className="w-full justify-center gap-2">
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
              View on BrickLink
            </BrickButton>
          </a>
        </div>

        {/* Right: forecast */}
        <div className="flex flex-col gap-6">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Current Price" value={`$${forecast.currentPrice.toLocaleString()}`} />
            <StatTile label="5y Projected" value={`$${forecast.projectedValue.toLocaleString()}`} />
            <StatTile
              label="5y ROI"
              value={`${forecast.roiPercent >= 0 ? "+" : ""}${forecast.roiPercent.toFixed(1)}%`}
              sub={`${forecast.dollarGain >= 0 ? "+" : ""}$${forecast.dollarGain.toLocaleString()} gain`}
              positive={forecast.roiPercent > 5}
              negative={forecast.roiPercent < -5}
            />
            <StatTile
              label="Annual Rate"
              value={`${(forecast.annualRate * 100).toFixed(1)}%`}
              sub="CAGR"
              positive={forecast.annualRate > 0.07}
            />
          </div>

          {/* Projection chart */}
          <BrickCard as="div">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="type-h3 text-jet-black">5-Year Projection</h2>
              <button
                onClick={() => setShowBreakdown(true)}
                className="type-body-sm text-bright-blue hover:underline underline-offset-2"
              >
                See breakdown
              </button>
            </div>
            <ForecastChart forecast={forecast} />
          </BrickCard>

          {/* ROI comparison */}
          <BrickCard as="div">
            <h2 className="type-h3 text-jet-black mb-4">Scenario ROI vs S&amp;P 500</h2>
            <RoiChart forecast={forecast} />
          </BrickCard>

          {/* Scenario table */}
          <BrickCard as="div">
            <h2 className="type-h3 text-jet-black mb-4">Scenario Outcomes</h2>
            <table className="w-full type-body-sm">
              <thead>
                <tr className="border-b-2 border-jet-black">
                  {["Scenario", "CAGR", "5y Value", "ROI"].map((h) => (
                    <th key={h} className="pb-2 text-left type-eyebrow text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["pessimist", "moderate", "optimist"] as const).map((s) => {
                  const sc = forecast.scenarios[s];
                  return (
                    <tr key={s} className="border-b border-slate-100">
                      <td className="py-2.5 capitalize font-medium text-jet-black">{s}</td>
                      <td className="py-2.5 type-mono-num text-slate-700">{(sc.annualRate * 100).toFixed(1)}%</td>
                      <td className="py-2.5 type-mono-num text-slate-700">${sc.projectedValue.toLocaleString()}</td>
                      <td className={`py-2.5 type-mono-num font-semibold ${sc.roiPercent > 0 ? "text-pure-green" : "text-brick-red"}`}>
                        {sc.roiPercent >= 0 ? "+" : ""}{sc.roiPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </BrickCard>

          <p className="type-body-sm text-slate-500 leading-relaxed">
            Projections are model estimates, not financial advice. LEGO set values are
            unpredictable. Past performance does not guarantee future results.{" "}
            <Link href="/sealed-forecast/methodology" className="text-bright-blue hover:underline underline-offset-2">
              How it works →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
