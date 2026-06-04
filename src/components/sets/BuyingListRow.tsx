import Link from "next/link";
import Image from "next/image";
import { BrickCard } from "@/components/ui/BrickCard";
import { SignalPill } from "@/components/ui/SignalPill";
import { StatusTag } from "@/components/ui/StatusTag";
import type { LegoSet } from "@/lib/domain/lego-set";
import { annualRoiLabel, brickLinkImageUrl, ebayUrl, legoStoreUrl, roiPercent } from "@/lib/domain/forecast";

interface Props {
  set: LegoSet;
  rank: number;
}

export function BuyingListRow({ set, rank }: Props) {
  const roi = roiPercent(set);
  return (
    <BrickCard className="mb-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex items-start gap-4 md:w-1/3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-jet-black bg-sunshine-yellow type-h4"
            style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </div>
          <div className="relative h-24 w-32 shrink-0 bg-pure-white rounded-chip overflow-hidden border border-slate-200">
            <Image
              src={brickLinkImageUrl(set)}
              alt={set.name}
              fill
              sizes="128px"
              className="object-contain p-2"
              unoptimized
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusTag status={set.status} />
            <SignalPill signal={set.signal} size="sm" />
            <span className="type-caption text-slate-500">{set.theme} · #{set.setNumber}</span>
          </div>
          <h3 className="type-h3" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            <Link href={`/set-forecast/${set.id}`} className="hover:underline">
              {set.name}
            </Link>
          </h3>
          <p className="type-body-sm text-slate-700 mt-1 line-clamp-2">{set.thesis}</p>
        </div>

        <div className="md:w-56 shrink-0 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="type-caption text-slate-500">Today</p>
              <p className="type-body-sm font-semibold">${set.currentPrice.toLocaleString()}</p>
            </div>
            <div>
              <p className="type-caption text-slate-500">5yr</p>
              <p className="type-body-sm font-semibold">${set.proj5y.toLocaleString()}</p>
            </div>
          </div>
          <p className={`type-body-sm font-semibold ${roi >= 0 ? "text-pure-green" : "text-brick-red"}`}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(0)}% · {annualRoiLabel(set)}
          </p>
          <a
            href={ebayUrl(set)}
            target="_blank"
            rel="noopener nofollow noreferrer sponsored"
            className="inline-flex items-center justify-center rounded-chip border-2 border-jet-black bg-pure-white px-3 py-1.5 type-body-sm font-medium hover:bg-sunshine-yellow transition-colors"
          >
            Check eBay →
          </a>
          {set.status !== "Retired" && (
            <a
              href={legoStoreUrl(set)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-chip border-2 border-jet-black bg-brick-red text-pure-white px-3 py-1.5 type-body-sm font-medium hover:-translate-x-px hover:-translate-y-px hover:shadow-click transition-all"
            >
              Buy on LEGO.com →
            </a>
          )}
        </div>
      </div>
    </BrickCard>
  );
}
