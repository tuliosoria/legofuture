import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGO_SETS } from "@/lib/data/sets";
import { loadLiveCuratedSet, loadLiveHistory } from "@/lib/data/live-catalog";
import { DetailHero } from "@/components/sets/DetailHero";
import { WhyThisRating } from "@/components/sets/WhyThisRating";
import { ScenarioCards } from "@/components/sets/ScenarioCards";
import { MvpForecastChart } from "@/components/sets/MvpForecastChart";
import { LiveMarketPanel } from "@/components/sets/LiveMarketPanel";
import { ThesisBlock } from "@/components/sets/ThesisBlock";

export const revalidate = 3600;

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGO_SETS.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const set = (await loadLiveCuratedSet(slug)) ?? LEGO_SETS.find((s) => s.id === slug);
  if (!set) return { title: "Set not found · BricksFuture" };
  return {
    title: `${set.name} (#${set.setNumber}) · BricksFuture`,
    description: `${set.signal}. ${set.thesis}`,
  };
}

export default async function SetDetailPage({ params }: Params) {
  const { slug } = await params;
  const [set, history] = await Promise.all([
    loadLiveCuratedSet(slug),
    loadLiveHistory(slug),
  ]);
  if (!set) notFound();

  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-8">
      <nav className="mb-6">
        <Link
          href="/set-forecast"
          className="type-body-sm text-slate-700 hover:text-jet-black hover:underline"
        >
          ← All forecasts
        </Link>
      </nav>

      <div className="space-y-10">
        <DetailHero set={set} />
        <WhyThisRating set={set} />
        <ScenarioCards set={set} />
        <MvpForecastChart set={set} history={history} />
        <LiveMarketPanel set={set} />
        <ThesisBlock set={set} />
      </div>
    </main>
  );
}
