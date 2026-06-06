import type { Metadata } from "next";
import Link from "next/link";
import { BrickCard } from "@/components/ui/BrickCard";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact & Methodology · LegoFuture",
  description:
    "Get in touch with the LegoFuture team or read how our 5-year forecasts and composite scoring work.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <p className="type-eyebrow text-slate-500">Contact</p>
      <h1
        className="type-h1 mt-2 mb-8"
        style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
      >
        Get in touch
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 mb-16">
        <BrickCard accentTop="red">
          <h2 className="type-h3 mb-3" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Send us a message
          </h2>
          <p className="type-body-sm text-slate-700 mb-4">
            Questions, set requests, partnership inquiries. We read everything.
          </p>
          <ContactForm />
        </BrickCard>

        <div>
          <BrickCard accentTop="blue" className="mb-4">
            <h3 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
              Direct
            </h3>
            <p className="type-body-sm text-slate-700">
              hello@legofuture.com
            </p>
          </BrickCard>
          <BrickCard accentTop="yellow">
            <h3 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
              Legal
            </h3>
            <ul className="space-y-2 type-body-sm">
              <li><Link href="/terms" className="text-bright-blue underline">Terms of use</Link></li>
              <li><Link href="/privacy" className="text-bright-blue underline">Privacy policy</Link></li>
              <li><Link href="/privacy-rights" className="text-bright-blue underline">Privacy rights / Do not sell</Link></li>
            </ul>
          </BrickCard>
        </div>
      </div>

      <section id="methodology" className="scroll-mt-24">
        <p className="type-eyebrow text-slate-500">Methodology</p>
        <h2
          className="type-h2 mt-2 mb-6"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          How our forecasts work
        </h2>

        <div className="prose prose-slate max-w-none type-body text-slate-700 space-y-4">
          <p>
            LegoFuture publishes a 5-year price forecast for every set in our catalog. The base-case
            forecast is the centerpiece, but every set also carries a bear and bull scenario so you can
            see the realistic range.
          </p>

          <h3 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Inputs
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Historical pricing:</strong> monthly sealed price snapshots from PriceCharting going back as far as available (typically 12 to 36 months per set), plus BrickLink sold comps and eBay completed listings.</li>
            <li><strong>Retirement status:</strong> active vs. retiring-soon vs. retired drives supply dynamics.</li>
            <li><strong>Community signal:</strong> Brick Insights aggregate rating (50%), Google Trends monthly search interest (25%), and Reddit mention volume × engagement (25%). Components are optional; missing signals are redistributed pro-rata. Synced monthly.</li>
            <li><strong>Market liquidity:</strong> active listing depth as a proxy for tradeability.</li>
            <li><strong>Price agreement:</strong> dispersion of recent sold comps around the consensus price.</li>
          </ul>
          <p className="mt-3 text-slate-700">
            Prices and signals update hourly via ISR. The ML model retrains weekly on the latest available data.
          </p>

          <h3 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Composite score
          </h3>
          <p>
            Each set gets a 0-100 composite score weighting forecast CAGR (35%), retirement status
            (25%), community demand (20%), and market liquidity + agreement (20%). Sets are then mapped
            to a signal: <strong>Strong Buy</strong> (best entry), <strong>Buy</strong>, <strong>Watch</strong>
            (wait for trigger), <strong>Hold</strong>, or <strong>Sell</strong>.
          </p>

          <h3 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            What we don&rsquo;t do
          </h3>
          <p>
            We do not give individualised financial advice. We do not guarantee returns. We do not
            account for taxes, transaction costs, storage costs, or condition risk. Forecasts are
            educational starting points. Always do your own research before buying.
          </p>

          <h3 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Disclosures
          </h3>
          <p>
            LegoFuture earns affiliate commissions on qualifying eBay purchases originated from links on
            this site. LEGO® is a trademark of the LEGO Group; LegoFuture is not affiliated with, endorsed
            by, or sponsored by the LEGO Group.
          </p>
        </div>
      </section>
    </main>
  );
}
