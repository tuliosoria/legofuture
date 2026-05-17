import Link from "next/link";
import { TrendingUp, Package, BarChart3 } from "lucide-react";
import { BrickHero } from "@/components/ui/BrickHero";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import { HeroStats } from "@/components/HeroStats";

export const revalidate = 300;

const PILLARS = [
  {
    accent: "blue" as const,
    icon: <TrendingUp className="w-6 h-6" strokeWidth={1.75} aria-hidden />,
    title: "Live pricing from PriceCharting",
    desc: "Current prices sourced directly from PriceCharting, with a bundled fallback snapshot. Always fresh, always honest.",
  },
  {
    accent: "red" as const,
    icon: <Package className="w-6 h-6" strokeWidth={1.75} aria-hidden />,
    title: "Retired vs current sets",
    desc: "Supply-constrained retired sets earn a higher base CAGR. We flag retirement status so you can stack the right sets.",
  },
  {
    accent: "green" as const,
    icon: <BarChart3 className="w-6 h-6" strokeWidth={1.75} aria-hidden />,
    title: "Five-year ROI projections",
    desc: "Three scenarios — pessimist, moderate, optimist — give you a range instead of a false-precision single number.",
  },
];

export default async function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <BrickHero
        eyebrow="Free · No login required · Educational tools only"
        title="Forecast every sealed brick."
        description="Buy / hold / sell signals on 20+ popular sets — Star Wars UCS, Technic, Architecture, Modular Buildings, and more."
        primaryCta={{ label: "See the forecast", href: "/set-forecast" }}
        secondaryCta={{ label: "Read the methodology", href: "/set-forecast/methodology" }}
        accentColor="yellow"
      />

      {/* Live catalog count */}
      <section className="bg-sunshine-yellow border-b-2 border-jet-black px-4 py-3">
        <div className="mx-auto max-w-[1240px] flex justify-center md:justify-start">
          <HeroStats />
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 px-4 bg-paper">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-12">
            <p className="type-eyebrow text-slate-500 mb-2">How we build the signal</p>
            <h2 className="type-h1 text-jet-black max-w-lg">Three pillars, one clear signal.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <BrickCard
                key={p.title}
                as="article"
                accentTop={p.accent}
                studStrip
              >
                <div className="w-10 h-10 rounded-card border-2 border-jet-black flex items-center justify-center mb-4">
                  {p.icon}
                </div>
                <h3 className="type-h3 text-jet-black mb-2">{p.title}</h3>
                <p className="type-body text-slate-700 leading-relaxed">{p.desc}</p>
              </BrickCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="mx-auto max-w-[1240px] text-center max-w-2xl mx-auto">
          <h2 className="type-h1 text-jet-black mb-4">Ready to build your position?</h2>
          <p className="type-body-lg text-slate-700 mb-8">
            No sign-up. No paywall. Informational tools only.
          </p>
          <Link href="/set-forecast">
            <BrickButton variant="primary" size="lg">
              Open Set Forecast
            </BrickButton>
          </Link>
          <div className="mt-10 rounded-card border-2 border-slate-100 bg-pure-white px-5 py-4 text-left type-body-sm text-slate-500 leading-relaxed max-w-2xl mx-auto">
            LegoFuture provides educational market-analysis tools for informational
            purposes only. It does not provide personalized financial, investment,
            tax, or legal advice. LEGO® is a trademark of the LEGO Group.
            LegoFuture is not affiliated with or endorsed by the LEGO Group.
            Review our{" "}
            <Link href="/terms" className="text-bright-blue hover:underline">
              Terms of Use
            </Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-bright-blue hover:underline">
              Privacy Policy
            </Link>
            {" "}before relying on this site.
          </div>
        </div>
      </section>
    </div>
  );
}
