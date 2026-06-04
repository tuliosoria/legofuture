import type { Metadata } from "next";
import Link from "next/link";
import { LEGO_SETS } from "@/lib/data/sets";
import { BuyingListRow } from "@/components/sets/BuyingListRow";
import { BrickCard } from "@/components/ui/BrickCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Monthly Buying Lists — LegoFuture",
  description:
    "Two ranked LEGO buying lists: retired sets riding post-discontinuation scarcity, and in-production sets to accumulate before retirement. Composite score blends forecast ROI, retirement status, community demand, and market liquidity.",
};

export default function BuyingListPage() {
  const retired = [...LEGO_SETS]
    .filter((s) => s.status === "Retired")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const inProduction = [...LEGO_SETS]
    .filter((s) => s.status === "Active" || s.status === "Retiring soon")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const stamp = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <div className="mb-8">
        <p className="type-eyebrow text-slate-500">Monthly buying lists · {stamp}</p>
        <h1
          className="type-h1 mt-2"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          Two ways to invest in LEGO
        </h1>
        <p className="type-body text-slate-700 mt-3 max-w-2xl">
          LEGO investing splits cleanly into two strategies: ride post-retirement scarcity, or
          accumulate in-production sets at MSRP before they retire. We rank the strongest signals in
          each by composite score.
        </p>
      </div>

      <BrickCard accentTop="yellow" className="mb-10">
        <h2 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          How we score
        </h2>
        <p className="type-body-sm text-slate-700 leading-relaxed">
          The composite score (0–100) weights: 5yr CAGR forecast (35%), retirement status (25%),
          community engagement (20%), and market liquidity + price agreement (20%). Sets are then ranked
          within their tier — a Strong Buy with a low score still beats a Hold with a high score. See the
          full methodology on the <Link href="/contact#methodology" className="text-bright-blue underline">contact page</Link>.
        </p>
      </BrickCard>

      {/* Retired Buying List */}
      <section className="mb-12">
        <div className="mb-4">
          <p className="type-eyebrow text-slate-500">List 01</p>
          <h2
            className="type-h2 mt-1"
            style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
          >
            Retired Buying List
          </h2>
        </div>

        <BrickCard accentTop="red" className="mb-6">
          <h3 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Investment thesis
          </h3>
          <p className="type-body-sm text-slate-700 leading-relaxed">
            Once LEGO retires a set, primary supply is permanently capped — the only sealed inventory
            left is whatever is already in distribution. Demand keeps compounding (collectors, gifters,
            new fandom waves) against a strictly shrinking float, which is why retired flagships
            historically deliver the cleanest LEGO returns. The trade-off: you&rsquo;re buying above
            MSRP and accepting whatever premium the secondary market has already priced in. We rank by
            composite score to surface the sets where the projected 5-year trajectory still justifies
            today&rsquo;s entry.
          </p>
        </BrickCard>

        <div>
          {retired.map((set, i) => (
            <BuyingListRow key={set.id} set={set} rank={i + 1} />
          ))}
        </div>
      </section>

      {/* In-Production Buying List */}
      <section className="mb-12">
        <div className="mb-4">
          <p className="type-eyebrow text-slate-500">List 02</p>
          <h2
            className="type-h2 mt-1"
            style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
          >
            In-Production Buying List
          </h2>
        </div>

        <BrickCard accentTop="blue" className="mb-6">
          <h3 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Investment thesis
          </h3>
          <p className="type-body-sm text-slate-700 leading-relaxed">
            Every retired set was an in-production set first. The biggest LEGO returns historically come
            from buying flagship sets at or below MSRP, holding through the announcement, and selling
            into the post-retirement scarcity wave. The cost is patience — you&rsquo;re typically
            sitting on a set 1–3 years before the retirement catalyst hits. We prioritise sets that are
            already <em>Retiring soon</em> (near-term catalyst), available at or under MSRP today, and
            from product lines with proven post-retirement appreciation (UCS Star Wars, Modular
            Buildings, Icons flagships, licensed Technic).
          </p>
        </BrickCard>

        <div>
          {inProduction.map((set, i) => (
            <BuyingListRow key={set.id} set={set} rank={i + 1} />
          ))}
        </div>
      </section>

      <p className="type-caption text-slate-500 mt-8 leading-relaxed">
        Educational forecasts only — not financial advice. Prices and signals update on a 1-hour cadence.
        eBay links are affiliate; LegoFuture earns a small commission on qualifying purchases. LEGO is a
        trademark of the LEGO Group; LegoFuture is not affiliated with or endorsed by the LEGO Group.
      </p>
    </main>
  );
}
