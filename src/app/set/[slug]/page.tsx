import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { CuratedSet } from "@/lib/types/curated";
import curatedSetsData from "@/lib/data/lego-curated-sets.json";
import { loadCuratedScores } from "@/lib/db/curated-sets";
import { computeCompositeScore } from "@/lib/domain/curated-score";
import { BrickCard } from "@/components/ui/BrickCard";
import { BrickButton } from "@/components/ui/BrickButton";
import { ChipBadge } from "@/components/ui/ChipBadge";
import { VoteButton } from "./VoteButton";
import type { ComponentProps } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const curatedSets = curatedSetsData as CuratedSet[];

type ChipColor = ComponentProps<typeof ChipBadge>["color"];
type AccentColor = ComponentProps<typeof BrickCard>["accentTop"];

const BAND_CHIP: Record<string, ChipColor> = {
  "strong-buy": "red",
  buy: "blue",
  watch: "yellow",
};

const BAND_ACCENT: Record<string, AccentColor> = {
  "strong-buy": "red",
  buy: "blue",
  watch: "yellow",
};

const BAND_LABEL: Record<string, string> = {
  "strong-buy": "Strong Buy",
  buy: "Buy",
  watch: "Watch",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const set = curatedSets.find((s) => s.slug === slug);
  if (!set) return { title: "Not Found" };
  return {
    title: `${set.name} Investment Analysis`,
    description: `LEGO ${set.name} (${set.setNumber}) investment score, retirement status, pricing, and community interest.`,
  };
}

const FACTOR_LABELS: Record<string, string> = {
  retirementTiming: "Retirement timing",
  themeStrength: "Theme strength",
  bricklinkDemand: "BrickLink demand",
  purchaseDiscount: "Purchase discount",
  exclusiveContent: "Exclusive content",
  communityVotes: "Community interest",
};

const FACTOR_WEIGHTS: Record<string, number> = {
  retirementTiming: 30,
  themeStrength: 20,
  bricklinkDemand: 15,
  purchaseDiscount: 15,
  exclusiveContent: 10,
  communityVotes: 10,
};

const BAND_TEXT_COLOR: Record<string, string> = {
  "strong-buy": "text-brick-red",
  buy: "text-bright-blue",
  watch: "text-slate-700",
};

export default async function SetDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const set = curatedSets.find((s) => s.slug === slug);
  if (!set) notFound();

  const scores = (await loadCuratedScores(set.setNumber)) ?? {
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
    maxVoteCount: Math.max(scores.voteCount, 1),
  });

  const bricklinkUrl = `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${set.setNumber}-1#T=S`;
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=LEGO+${encodeURIComponent(set.setNumber)}+sealed&LH_Sold=1`;
  const legoUrl = `https://www.lego.com/en-us/search?q=${set.setNumber}`;

  const bandChip = BAND_CHIP[compositeScore.band] ?? "black";
  const bandAccent = BAND_ACCENT[compositeScore.band] ?? "black";
  const bandLabel = BAND_LABEL[compositeScore.band] ?? compositeScore.band;
  const bandTextColor = BAND_TEXT_COLOR[compositeScore.band] ?? "text-jet-black";

  return (
    <main className="bg-paper min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1240px]">
        {/* Breadcrumb */}
        <nav className="type-eyebrow text-slate-500 mb-6 flex gap-2">
          <Link
            href="/watchlist"
            className="hover:text-jet-black transition-colors"
          >
            Watchlist
          </Link>
          <span>›</span>
          <span className="text-jet-black">{set.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Left: details */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <ChipBadge color={bandChip}>{bandLabel}</ChipBadge>
                {set.retired && <ChipBadge color="black">Retired</ChipBadge>}
                {!set.retired && set.retiringSoon && (
                  <ChipBadge color="red">Retiring soon</ChipBadge>
                )}
                <ChipBadge color="slate">{set.theme}</ChipBadge>
              </div>
              <h1 className="type-display-2 text-jet-black mb-1">{set.name}</h1>
              <p className="type-body text-slate-500">
                Set #{set.setNumber}
                {set.subtheme ? ` · ${set.subtheme}` : ""}
                {" · "}
                {set.pieceCount.toLocaleString()} pieces
              </p>
            </div>

            {/* Score breakdown */}
            <BrickCard as="section" accentTop={bandAccent}>
              <div className="flex items-baseline gap-3 mb-5">
                <span
                  className={`text-5xl font-extrabold ${bandTextColor}`}
                  style={{ fontFamily: "var(--nf-jakarta)" }}
                >
                  {compositeScore.total}
                </span>
                <span className="type-body text-slate-500">/ 100</span>
                <span className="type-eyebrow text-slate-400 ml-auto">
                  Composite score
                </span>
              </div>

              <div className="space-y-3">
                {(
                  Object.entries(compositeScore.factors) as [
                    keyof typeof compositeScore.factors,
                    number,
                  ][]
                ).map(([key, value]) => {
                  const weight = FACTOR_WEIGHTS[key] ?? 0;
                  const pct = (value / 5) * 100;
                  return (
                    <div key={key}>
                      <div className="flex justify-between type-eyebrow text-slate-500 mb-1">
                        <span>{FACTOR_LABELS[key]}</span>
                        <span>
                          {value.toFixed(1)} / 5 · {weight}% weight
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full border border-jet-black/10 overflow-hidden">
                        <div
                          className="h-full bg-bright-blue rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </BrickCard>

            {/* Notes */}
            {set.notes && (
              <BrickCard as="section">
                <p className="type-eyebrow text-slate-500 mb-2">
                  Investment thesis
                </p>
                <p className="type-body text-slate-700 leading-relaxed">
                  {set.notes}
                </p>
              </BrickCard>
            )}

            {/* Community */}
            <BrickCard as="section">
              <p className="type-eyebrow text-slate-500 mb-3">
                Community interest
              </p>
              <VoteButton
                setNumber={set.setNumber}
                initialVoteCount={scores.voteCount}
              />
            </BrickCard>
          </div>

          {/* Right: image + pricing + links */}
          <div className="space-y-6">
            {/* Image */}
            <BrickCard as="div">
              <div className="relative aspect-square bg-slate-50 rounded-sm overflow-hidden border-2 border-jet-black">
                {set.imageUrl ? (
                  <Image
                    src={set.imageUrl}
                    alt={set.name}
                    fill
                    className="object-contain p-6"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center type-body text-slate-300">
                    #{set.setNumber}
                  </div>
                )}
              </div>
            </BrickCard>

            {/* Pricing */}
            <BrickCard as="section" accentTop="green">
              <p className="type-eyebrow text-slate-500 mb-3">Pricing</p>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="type-eyebrow text-slate-500">MSRP</dt>
                  <dd className="type-mono-num text-jet-black">
                    ${set.originalMsrp.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="type-eyebrow text-slate-500">Target buy</dt>
                  <dd className="type-mono-num text-pure-green font-bold">
                    ${set.targetBuyPrice.toLocaleString()}
                  </dd>
                </div>
                {scores.currentPrice != null && (
                  <div>
                    <dt className="type-eyebrow text-slate-500">Current</dt>
                    <dd className="type-mono-num text-jet-black">
                      ${scores.currentPrice.toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </BrickCard>

            {/* Buy links */}
            <BrickCard as="section">
              <p className="type-eyebrow text-slate-500 mb-3">Research & buy</p>
              <div className="flex flex-col gap-2">
                <a
                  href={bricklinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between type-body-sm text-slate-700 hover:text-jet-black transition-colors border border-slate-200 rounded-card px-3 py-2"
                >
                  BrickLink sold prices
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
                <a
                  href={ebayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between type-body-sm text-slate-700 hover:text-jet-black transition-colors border border-slate-200 rounded-card px-3 py-2"
                >
                  eBay sold listings
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
                <a
                  href={legoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between type-body-sm text-slate-700 hover:text-jet-black transition-colors border border-slate-200 rounded-card px-3 py-2"
                >
                  LEGO.com
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
              </div>
            </BrickCard>
          </div>
        </div>
      </div>
    </main>
  );
}
