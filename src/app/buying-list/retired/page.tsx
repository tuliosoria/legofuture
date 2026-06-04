import type { Metadata } from "next";
import Link from "next/link";
import { loadLiveCuratedCatalog } from "@/lib/data/live-catalog";
import { BuyingListRow } from "@/components/sets/BuyingListRow";
import { BrickCard } from "@/components/ui/BrickCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Retired Buying List — LegoFuture",
  description:
    "Top 10 retired LEGO sets ranked by composite score. Permanently capped supply meeting compounding collector demand — the cleanest LEGO investment thesis.",
};

export default async function RetiredBuyingListPage() {
  const allSets = await loadLiveCuratedCatalog();
  const picks = [...allSets]
    .filter((s) => s.status === "Retired")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const stamp = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <div className="mb-8">
        <p className="type-eyebrow text-slate-500">Retired buying list · {stamp}</p>
        <h1
          className="type-h1 mt-2"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          Retired Buying List
        </h1>
        <p className="type-body text-slate-700 mt-3 max-w-2xl">
          The top 10 already-retired LEGO sets ranked by composite score. Companion list:{" "}
          <Link href="/buying-list/non-retired" className="text-bright-blue underline">
            Non-Retired Buying List
          </Link>
          .
        </p>
      </div>

      <BrickCard accentTop="red" className="mb-6">
        <h2 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          Investment thesis
        </h2>
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

      <BrickCard accentTop="yellow" className="mb-8">
        <h2 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          How we score
        </h2>
        <p className="type-body-sm text-slate-700 leading-relaxed">
          The composite score (0–100) weights: 5yr CAGR forecast (35%), retirement status (25%),
          community engagement (20%), and market liquidity + price agreement (20%). See the full
          methodology on the <Link href="/contact#methodology" className="text-bright-blue underline">contact page</Link>.
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
