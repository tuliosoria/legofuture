import type { Metadata } from "next";
import Link from "next/link";
import { LEGO_SETS } from "@/lib/data/sets";
import { BuyingListRow } from "@/components/sets/BuyingListRow";
import { BrickCard } from "@/components/ui/BrickCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Monthly Buying List — LegoFuture",
  description:
    "The 15 LEGO sets with the strongest investment signal this month. Ranked by composite score across forecast ROI, retirement status, community demand, and market liquidity.",
};

export default function BuyingListPage() {
  const picks = [...LEGO_SETS].sort((a, b) => b.score - a.score).slice(0, 15);
  const stamp = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <div className="mb-8">
        <p className="type-eyebrow text-slate-500">Monthly buying list · {stamp}</p>
        <h1
          className="type-h1 mt-2"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          Top 15 LEGO picks
        </h1>
        <p className="type-body text-slate-700 mt-3 max-w-2xl">
          A monthly shortlist of LEGO sets with the strongest investment signal across forecast ROI,
          retirement status, community demand, and market liquidity. Ranked by composite score.
        </p>
      </div>

      <BrickCard accentTop="yellow" className="mb-8">
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

      <div>
        {picks.map((set, i) => (
          <BuyingListRow key={set.id} set={set} rank={i + 1} />
        ))}
      </div>

      <p className="type-caption text-slate-500 mt-8 leading-relaxed">
        Educational forecasts only — not financial advice. Prices and signals update on a 1-hour cadence.
        eBay links are affiliate; LegoFuture earns a small commission on qualifying purchases. LEGO is a
        trademark of the LEGO Group; LegoFuture is not affiliated with or endorsed by the LEGO Group.
      </p>
    </main>
  );
}
