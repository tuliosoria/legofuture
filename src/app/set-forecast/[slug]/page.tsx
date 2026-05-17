import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/db/lego-search";
import { getPricing } from "@/lib/domain/lego-estimate";
import { forecastForSet } from "@/lib/domain/lego-forecast";
import { loadHistory } from "@/lib/db/lego-history";
import { resolveBricklinkSetUrl } from "@/lib/domain/lego-bricklink";
import { SignalBadge } from "@/components/sets/SignalBadge";
import { ForecastChart } from "@/components/sets/ForecastChart";
import { ModelDetails } from "@/components/sets/ModelDetails";
import { ConditionSelector } from "@/components/sets/condition-selector";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import { ChipBadge } from "@/components/ui/ChipBadge";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not Found | LegoFuture" };
  return {
    title: `${product.name} Forecast | LegoFuture`,
    description: `5-year price forecast for LEGO ${product.name} (${product.setNumber}). Scenarios, key drivers, and BrickLink marketplace link.`,
  };
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [pricing, history] = await Promise.all([
    getPricing(product),
    loadHistory(product, "new-sealed"),
  ]);
  const forecast = forecastForSet(product, pricing, history);
  const bricklinkUrl = resolveBricklinkSetUrl(product.setNumber);

  const currentPrice = forecast.currentPrice;
  const pricingForSelector = {
    newSealed: pricing?.newPrice ?? null,
    complete: pricing?.cibPrice ?? null,
    loose: pricing?.loosePrice ?? null,
  };

  const statusChip = product.retired
    ? { label: "Retired", color: "black" as const }
    : product.retiringSoon
      ? { label: "Retiring soon", color: "yellow" as const }
      : { label: "Active", color: "blue" as const };

  return (
    <main>
      {/* Hero strip */}
      <div className="bg-pure-white border-b-2 border-jet-black">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-8">
          <nav className="mb-4 type-body-sm text-slate-500">
            <Link href="/set-forecast" className="hover:underline">
              ← Back to Catalog
            </Link>
          </nav>
          <div className="grid gap-6 md:grid-cols-[260px_1fr] items-start">
            <div className="relative aspect-square overflow-hidden rounded-card border-2 border-jet-black bg-pure-white">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 260px"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center type-body-sm text-slate-400">
                  No image
                </div>
              )}
            </div>
            <div>
              <p className="type-eyebrow text-slate-500 mb-2">
                Set #{product.setNumber} · Released {product.releaseYear}
              </p>
              <h1 className="type-display-2 text-jet-black mb-3">
                {product.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <ChipBadge color="blue">{product.theme}</ChipBadge>
                {product.era && <ChipBadge color="yellow">{product.era}</ChipBadge>}
                <ChipBadge color={statusChip.color}>{statusChip.label}</ChipBadge>
                {forecast.forecastEligible && (
                  <SignalBadge recommendation={forecast.recommendation} />
                )}
              </div>
              <ConditionSelector pricing={pricingForSelector} />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10 flex flex-col gap-8">
        {!forecast.forecastEligible ? (
          <BrickCard as="div">
            <div className="text-center py-10 px-6">
              <h2 className="type-h2 text-jet-black mb-3">
                Insufficient price history.
              </h2>
              <p className="type-body text-slate-700 max-w-xl mx-auto">
                We need at least 3 monthly price points before producing a
                forecast for this set. Live price still shown above.
              </p>
            </div>
          </BrickCard>
        ) : (
          <>
            {/* Forecast strip */}
            <section>
              <h2 className="type-h3 text-jet-black mb-4">5-year scenarios</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {(["pessimist", "moderate", "optimist"] as const).map((s) => {
                  const sc = forecast.scenarios[s];
                  const delta =
                    currentPrice && currentPrice > 0
                      ? sc.projectedValue5yr - currentPrice
                      : null;
                  const tone =
                    s === "optimist"
                      ? "text-pure-green"
                      : s === "pessimist"
                        ? "text-brick-red"
                        : "text-bright-blue";
                  return (
                    <BrickCard key={s} as="div">
                      <p className="type-eyebrow text-slate-500 mb-1 capitalize">
                        {s}
                      </p>
                      <p className={`type-mono-num text-3xl font-bold ${tone}`}>
                        {fmtUsd(sc.projectedValue5yr)}
                      </p>
                      <p className="type-body-sm text-slate-600 mt-1">
                        {fmtPct(sc.cagr)} CAGR
                        {delta !== null && (
                          <>
                            {" · "}
                            <span className={delta >= 0 ? "text-pure-green" : "text-brick-red"}>
                              {delta >= 0 ? "+" : ""}
                              {fmtUsd(delta)}
                            </span>{" "}
                            vs today
                          </>
                        )}
                      </p>
                    </BrickCard>
                  );
                })}
              </div>
            </section>

            {/* Chart */}
            <BrickCard as="div">
              <h2 className="type-h3 text-jet-black mb-4">Projection (5 years)</h2>
              <ForecastChart series={forecast.projectionSeries} />
            </BrickCard>

            {/* Breakdown + Drivers */}
            <div className="grid gap-6 lg:grid-cols-2">
              <BrickCard as="div">
                <h2 className="type-h3 text-jet-black mb-4">Forecast breakdown</h2>
                {forecast.breakdown.length === 0 ? (
                  <p className="type-body-sm text-slate-500">
                    Breakdown will appear once more signals accumulate.
                  </p>
                ) : (
                  <dl className="flex flex-col">
                    {forecast.breakdown.map((row, i) => (
                      <div
                        key={i}
                        className="flex justify-between gap-4 border-b border-slate-100 py-2.5"
                      >
                        <div>
                          <dt className="type-body-sm font-medium text-jet-black">
                            {row.label}
                          </dt>
                          {row.sub && (
                            <p className="type-body-sm text-slate-500">{row.sub}</p>
                          )}
                        </div>
                        <dd className="type-mono-num text-jet-black font-semibold whitespace-nowrap">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </BrickCard>

              <BrickCard as="div">
                <h2 className="type-h3 text-jet-black mb-4">Key drivers</h2>
                {forecast.drivers.length === 0 ? (
                  <p className="type-body-sm text-slate-500">
                    Drivers will appear once more signals accumulate.
                  </p>
                ) : (
                  <ul className="list-disc pl-5 type-body text-slate-700 space-y-2">
                    {forecast.drivers.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </BrickCard>
            </div>

            {/* Model details */}
            <ModelDetails
              confidence={forecast.confidence}
              updatedAt={forecast.updatedAt}
            />
          </>
        )}

        {/* Marketplace strip */}
        <BrickCard as="div">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="type-h3 text-jet-black mb-1">Buy this set</h2>
              <p className="type-body-sm text-slate-600">
                BrickLink is the world&apos;s largest LEGO marketplace.
              </p>
            </div>
            {bricklinkUrl ? (
              <a
                href={bricklinkUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <BrickButton size="lg" className="gap-2">
                  Buy on BrickLink
                  <ExternalLink className="h-4 w-4" strokeWidth={2} />
                </BrickButton>
              </a>
            ) : (
              <span className="type-body-sm font-semibold text-slate-500 border-2 border-dashed border-slate-300 rounded-md px-4 py-2">
                Marketplace link unavailable
              </span>
            )}
          </div>
        </BrickCard>

        <p className="type-body-sm text-slate-500 leading-relaxed">
          LegoFuture is informational. Forecasts are model estimates — not
          guarantees. Always verify prices before buying or selling.{" "}
          <Link
            href="/set-forecast/methodology"
            className="text-bright-blue hover:underline underline-offset-2"
          >
            How it works →
          </Link>
        </p>
      </div>
    </main>
  );
}
