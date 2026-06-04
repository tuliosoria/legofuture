import type { Metadata } from "next";
import Link from "next/link";
import { LEGO_SETS } from "@/lib/data/sets";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import { SetCard } from "@/components/sets/SetCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "LegoFuture — 5-year forecasts for investment-grade LEGO sets",
  description:
    "Data-driven 5-year price forecasts for sealed LEGO sets. Monthly buying list, full catalog, scenario modelling — all in one place.",
};

export default function HomePage() {
  const topPicks = [...LEGO_SETS].sort((a, b) => b.score - a.score).slice(0, 6);
  const buyCount = LEGO_SETS.filter((s) => s.signal === "Buy" || s.signal === "Strong Buy").length;
  const retiringSoon = LEGO_SETS.filter((s) => s.status === "Retiring soon").length;

  return (
    <main>
      {/* Hero */}
      <section className="bg-paper border-b-2 border-jet-black">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <p className="type-eyebrow text-brick-red mb-3">5-year price forecasts</p>
            <h1
              className="type-display"
              style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
            >
              The screener for sealed-LEGO investors.
            </h1>
            <p className="type-body-lg text-slate-700 mt-5 max-w-xl">
              Forecast 5-year returns on {LEGO_SETS.length} investment-grade LEGO sets.
              Compare against the S&amp;P 500. Spot retirement opportunities before the market does.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/buying-list/retired">
                <BrickButton variant="primary" size="lg">See this month&rsquo;s buying lists →</BrickButton>
              </Link>
              <Link href="/set-forecast">
                <BrickButton variant="secondary" size="lg">Browse all forecasts</BrickButton>
              </Link>
            </div>
          </div>
          <BrickCard accentTop="red" studStrip className="hidden lg:block">
            <p className="type-eyebrow text-slate-500 mb-2">Featured</p>
            <p className="type-h2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
              {topPicks[0].name}
            </p>
            <p className="type-body-sm text-slate-700 mt-2">
              5yr forecast <strong>${topPicks[0].proj5y.toLocaleString()}</strong> from today&rsquo;s
              ${topPicks[0].currentPrice.toLocaleString()} · {topPicks[0].signal}
            </p>
            <Link
              href={`/set-forecast/${topPicks[0].id}`}
              className="type-body-sm text-bright-blue underline mt-3 inline-block"
            >
              View forecast →
            </Link>
          </BrickCard>
        </div>
      </section>

      {/* Top picks rail */}
      <section className="mx-auto max-w-[1240px] px-4 md:px-8 py-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="type-eyebrow text-slate-500">This month</p>
            <h2 className="type-h2 mt-1" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
              Top 6 picks
            </h2>
          </div>
          <Link href="/buying-list/retired" className="type-body-sm text-bright-blue underline">
            See full buying lists →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((s) => (
            <SetCard key={s.id} set={s} />
          ))}
        </div>
      </section>

      {/* Three-pillar explainer */}
      <section className="bg-pure-white border-y-2 border-jet-black">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-16">
          <h2
            className="type-h2 mb-8 text-center"
            style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
          >
            How LegoFuture works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <BrickCard accentTop="blue">
              <p className="type-eyebrow text-bright-blue mb-2">01</p>
              <h3 className="type-h4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
                Sealed-set focus
              </h3>
              <p className="type-body-sm text-slate-700 mt-2">
                We track only sealed, factory-new LEGO sets — the segment where retirement supply shocks
                drive consistent appreciation.
              </p>
            </BrickCard>
            <BrickCard accentTop="yellow">
              <p className="type-eyebrow text-slate-700 mb-2">02</p>
              <h3 className="type-h4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
                Composite scoring
              </h3>
              <p className="type-body-sm text-slate-700 mt-2">
                Each set is scored 0–100 across forecast ROI, retirement status, community demand, and
                market liquidity — then mapped to a clear buy/watch/hold signal.
              </p>
            </BrickCard>
            <BrickCard accentTop="green">
              <p className="type-eyebrow text-pure-green mb-2">03</p>
              <h3 className="type-h4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
                Benchmarked vs. S&amp;P 500
              </h3>
              <p className="type-body-sm text-slate-700 mt-2">
                Every forecast is overlaid against a 10.5% S&amp;P 500 baseline so you can see whether a
                given set actually beats the market.
              </p>
            </BrickCard>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-jet-black text-paper">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat label="Sets tracked" value={LEGO_SETS.length.toString()} />
          <Stat label="Buy signals" value={buyCount.toString()} />
          <Stat label="Retiring soon" value={retiringSoon.toString()} />
          <Stat label="Forecast horizon" value="5yr" />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="type-h1 text-sunshine-yellow"
        style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
      >
        {value}
      </p>
      <p className="type-body-sm text-slate-300 mt-1">{label}</p>
    </div>
  );
}
