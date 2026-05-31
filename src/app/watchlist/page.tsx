import type { Metadata } from "next";
import type { CuratedItem, CuratedSet } from "@/lib/types/curated";
import curatedSetsData from "@/lib/data/lego-curated-sets.json";
import { loadAllCuratedScores } from "@/lib/db/curated-sets";
import { computeCompositeScore } from "@/lib/domain/curated-score";
import { WatchlistCard } from "@/components/sets/WatchlistCard";
import { BrickHero } from "@/components/ui/BrickHero";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title: "LEGO Investment Watchlist | LegoFuture",
  description:
    "Hand-curated LEGO sets with strong investment potential. Composite scores built from retirement timing, theme demand, BrickLink sales, and community interest.",
};

const curatedSets = curatedSetsData as CuratedSet[];

export default async function WatchlistPage() {
  const setNumbers = curatedSets.map((s) => s.setNumber);
  const scoresMap = await loadAllCuratedScores(setNumbers);
  const maxVoteCount = Math.max(
    ...Array.from(scoresMap.values()).map((s) => s.voteCount),
    1
  );

  const items: CuratedItem[] = curatedSets.map((set) => {
    const scores = scoresMap.get(set.setNumber) ?? {
      setNumber: set.setNumber,
      bricklinkSoldCount6mo: null,
      retirementMonthsRemaining: null,
      currentPrice: null,
      voteCount: 0,
      lastRefreshed: "",
    };
    const compositeScore = computeCompositeScore({
      retirementMonthsRemaining: scores.retirementMonthsRemaining,
      retired: set.retired,
      theme: set.theme,
      bricklinkSoldCount6mo: scores.bricklinkSoldCount6mo,
      currentPrice: scores.currentPrice,
      originalMsrp: set.originalMsrp,
      hasExclusiveMinifigs: set.hasExclusiveMinifigs,
      voteCount: scores.voteCount,
      maxVoteCount,
    });
    return { set, scores, compositeScore };
  });

  items.sort((a, b) => b.compositeScore.total - a.compositeScore.total);

  const strongBuyCount = items.filter(
    (i) => i.compositeScore.band === "strong-buy"
  ).length;

  return (
    <div className="flex flex-col">
      <BrickHero
        eyebrow="Curated picks · Updated weekly"
        title="Sets worth watching."
        description={`${items.length} hand-approved sets scored for retirement timing, theme demand, BrickLink liquidity, and community interest.`}
        primaryCta={{ label: "Jump to picks ↓", href: "#picks" }}
        accentColor="red"
      />

      {/* Stats bar */}
      <section className="bg-sunshine-yellow border-b-2 border-jet-black px-4 py-3">
        <div className="mx-auto max-w-[1240px] flex flex-wrap gap-4 items-center">
          <span className="type-body-sm font-medium text-jet-black">
            {strongBuyCount} Strong Buy
          </span>
          <span className="type-body-sm text-slate-700">
            {items.filter((i) => i.compositeScore.band === "buy").length} Buy
          </span>
          <span className="type-body-sm text-slate-700">
            {items.filter((i) => i.compositeScore.band === "watch").length}{" "}
            Watch
          </span>
        </div>
      </section>

      {/* Grid */}
      <section id="picks" className="py-12 px-4 bg-paper">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <WatchlistCard key={item.set.setNumber} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-4 py-8 bg-paper border-t-2 border-slate-100">
        <div className="mx-auto max-w-[1240px]">
          <p className="type-body-sm text-slate-500 leading-relaxed max-w-2xl">
            LegoFuture provides educational tools for informational purposes only.
            Composite scores are not financial advice. Past LEGO set appreciation
            does not guarantee future returns. Always do your own research before
            purchasing any collectible or investment.
          </p>
        </div>
      </section>
    </div>
  );
}
