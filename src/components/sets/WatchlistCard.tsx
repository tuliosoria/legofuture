import Link from "next/link";
import Image from "next/image";
import { Eye } from "lucide-react";
import type { CuratedItem } from "@/lib/types/curated";
import { BrickCard } from "@/components/ui/BrickCard";
import { ChipBadge } from "@/components/ui/ChipBadge";
import type { ComponentProps } from "react";

type AccentColor = ComponentProps<typeof BrickCard>["accentTop"];
type ChipColor = ComponentProps<typeof ChipBadge>["color"];

const BAND_ACCENT: Record<string, AccentColor> = {
  "strong-buy": "red",
  buy: "blue",
  watch: "yellow",
};

const BAND_CHIP: Record<string, ChipColor> = {
  "strong-buy": "red",
  buy: "blue",
  watch: "yellow",
};

const BAND_LABEL: Record<string, string> = {
  "strong-buy": "Strong Buy",
  buy: "Buy",
  watch: "Watch",
};

interface WatchlistCardProps {
  item: CuratedItem;
}

export function WatchlistCard({ item }: WatchlistCardProps) {
  const { set, scores, compositeScore } = item;
  const accent = BAND_ACCENT[compositeScore.band] ?? "black";
  const chipColor = BAND_CHIP[compositeScore.band] ?? "black";
  const bandLabel = BAND_LABEL[compositeScore.band] ?? compositeScore.band;

  return (
    <Link
      href={`/set/${set.slug}`}
      aria-label={`View ${set.name} watchlist entry`}
      className="group block h-full"
    >
      <BrickCard
        as="article"
        accentTop={accent}
        studStrip
        compact
        className="h-full flex flex-col gap-0 transition-all duration-[120ms] group-hover:-translate-y-px group-hover:shadow-click-lg"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-slate-50 -mx-4 -mt-4 mb-4 border-b-2 border-jet-black">
          {set.imageUrl ? (
            <Image
              src={set.imageUrl}
              alt={set.name}
              fill
              className="object-contain p-4 transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center type-body-sm text-slate-300">
              #{set.setNumber}
            </div>
          )}
          {set.retired && (
            <span className="absolute left-2 top-2 bg-jet-black text-pure-white type-eyebrow px-2 py-0.5 rounded-chip">
              Retired
            </span>
          )}
          {!set.retired && set.retiringSoon && (
            <span className="absolute left-2 top-2 bg-brick-red text-pure-white type-eyebrow px-2 py-0.5 rounded-chip">
              Retiring soon
            </span>
          )}
        </div>

        {/* Name + theme */}
        <div className="flex-1 mb-3">
          <h3 className="type-body-sm font-medium text-jet-black leading-tight line-clamp-2 mb-1">
            {set.name}
          </h3>
          <p className="type-eyebrow text-slate-500">
            {set.theme}
            {set.subtheme ? ` · ${set.subtheme}` : ""}
            {" · "}#{set.setNumber}
          </p>
        </div>

        {/* Score + band chip */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="type-mono-num font-bold text-jet-black text-lg leading-none">
            {compositeScore.total}
          </span>
          <ChipBadge color={chipColor}>{bandLabel}</ChipBadge>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="type-eyebrow text-slate-500">Current</p>
            <p className="type-mono-num text-jet-black">
              {scores.currentPrice != null
                ? `$${scores.currentPrice.toLocaleString()}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="type-eyebrow text-slate-500">Target buy</p>
            <p className="type-mono-num text-pure-green">
              ${set.targetBuyPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Community count */}
        <div className="flex items-center gap-1 type-eyebrow text-slate-500 border-t border-slate-100 pt-2">
          <Eye className="w-3 h-3" aria-hidden />
          {scores.voteCount > 0
            ? `${scores.voteCount.toLocaleString()} watching`
            : "Be the first to watch"}
        </div>
      </BrickCard>
    </Link>
  );
}
