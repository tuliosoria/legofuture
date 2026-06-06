import type { Metadata } from "next";
import Link from "next/link";
import { loadLiveCuratedCatalog } from "@/lib/data/live-catalog";
import { BuyingListRow } from "@/components/sets/BuyingListRow";
import { BrickCard } from "@/components/ui/BrickCard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Non-Retired Buying List · LegoFuture",
  description:
    "Top 10 still-in-production LEGO sets to accumulate at or below MSRP before the retirement catalyst. A patience trade for a lower entry price.",
};

export default async function NonRetiredBuyingListPage() {
  const allSets = await loadLiveCuratedCatalog();
  const picks = [...allSets]
    .filter((s) => s.status === "Active" || s.status === "Retiring soon")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const stamp = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <div className="mb-8">
        <p className="type-eyebrow text-slate-500">Non-retired buying list · {stamp}</p>
        <h1
          className="type-h1 mt-2"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          Non-Retired Buying List
        </h1>
        <p className="type-body text-slate-700 mt-3 max-w-2xl">
          The top 10 still-in-production LEGO sets ranked by composite score. Includes
          Active and Retiring soon. Companion list:{" "}
          <Link href="/buying-list/retired" className="text-bright-blue underline">
            Retired Buying List
          </Link>
          .
        </p>
      </div>

      <BrickCard accentTop="blue" className="mb-6">
        <h2 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          Investment thesis
        </h2>
        <p className="type-body-sm text-slate-700 leading-relaxed">
          Every retired flagship was an in-production set first. The biggest LEGO returns
          historically come from buying flagships at or below MSRP, holding through the
          retirement announcement, and selling into the post-retirement scarcity wave. The
          cost is patience. You are typically sitting on a set 1 to 3 years before the
          retirement catalyst hits. We prioritise sets that are already <em>Retiring soon</em>,
          available at or under MSRP today, and from product lines with a track record of
          post-retirement appreciation (UCS Star Wars, Modular Buildings, Icons flagships,
          licensed Technic).
        </p>
      </BrickCard>

      <BrickCard accentTop="yellow" className="mb-8">
        <h2 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          How we score
        </h2>
        <p className="type-body-sm text-slate-700 leading-relaxed">
          The composite score (0-100) weights: 5yr CAGR forecast (35%), retirement status (25%),
          community engagement (20%), and market liquidity plus price agreement (20%). See the
          full methodology on the <Link href="/contact#methodology" className="text-bright-blue underline">contact page</Link>.
        </p>
      </BrickCard>

      <div>
        {picks.map((set, i) => (
          <BuyingListRow key={set.id} set={set} rank={i + 1} />
        ))}
      </div>

      <p className="type-caption text-slate-500 mt-8 leading-relaxed">
        Educational forecasts only. Not financial advice. Prices and signals update on a 1-hour cadence.
        eBay links are affiliate; LegoFuture earns a small commission on qualifying purchases. LEGO is a
        trademark of the LEGO Group; LegoFuture is not affiliated with or endorsed by the LEGO Group.
      </p>
    </main>
  );
}
