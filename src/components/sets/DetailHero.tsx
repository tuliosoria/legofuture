import Image from "next/image";
import { SignalPill } from "@/components/ui/SignalPill";
import { StatusTag } from "@/components/ui/StatusTag";
import { ConfidenceDots } from "@/components/ui/ConfidenceDots";
import type { LegoSet } from "@/lib/domain/lego-set";
import {
  annualRoiLabel,
  brickLinkImageUrl,
  brickLinkUrl,
  ebayUrl,
  roiPercent,
} from "@/lib/domain/forecast";

interface Props {
  set: LegoSet;
}

export function DetailHero({ set }: Props) {
  const roi = roiPercent(set);
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
      <div className="relative aspect-[4/3] w-full bg-pure-white rounded-card overflow-hidden border-2 border-jet-black shadow-click">
        <Image
          src={brickLinkImageUrl(set)}
          alt={set.name}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain p-6"
          unoptimized
          priority
        />
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <StatusTag status={set.status} />
          <span className="type-caption text-slate-500">{set.theme}</span>
          <span className="type-caption text-slate-500">·</span>
          <span className="type-caption text-slate-500">#{set.setNumber}</span>
          <span className="type-caption text-slate-500">·</span>
          <span className="type-caption text-slate-500">{set.pieces.toLocaleString()} pcs</span>
          <span className="type-caption text-slate-500">·</span>
          <span className="type-caption text-slate-500">{set.year}</span>
        </div>

        <h1
          className="type-h1 mb-4"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          {set.name}
        </h1>

        <div className="flex items-center gap-3 mb-6">
          <SignalPill signal={set.signal} />
          <div className="flex items-center gap-2">
            <ConfidenceDots filled={set.confidence} />
            <span className="type-body-sm text-slate-700">{set.confLabel} confidence</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 border-y-2 border-jet-black py-4">
          <div>
            <p className="type-caption text-slate-500">MSRP</p>
            <p className="type-h4">${set.msrp.toLocaleString()}</p>
          </div>
          <div>
            <p className="type-caption text-slate-500">Today</p>
            <p className="type-h4">${set.currentPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="type-caption text-slate-500">5yr forecast</p>
            <p className={`type-h4 ${roi >= 0 ? "text-pure-green" : "text-brick-red"}`}>
              ${set.proj5y.toLocaleString()}
            </p>
            <p className={`type-caption ${roi >= 0 ? "text-pure-green" : "text-brick-red"}`}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(0)}% · {annualRoiLabel(set)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={ebayUrl(set)}
            target="_blank"
            rel="noopener nofollow noreferrer sponsored"
            className="inline-flex items-center justify-center rounded-chip border-2 border-jet-black bg-brick-red text-pure-white px-4 py-2 type-body-sm font-semibold hover:-translate-x-px hover:-translate-y-px hover:shadow-click transition-all"
          >
            Check eBay listings →
          </a>
          <a
            href={brickLinkUrl(set)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-chip border-2 border-jet-black bg-pure-white px-4 py-2 type-body-sm font-semibold hover:bg-sunshine-yellow transition-colors"
          >
            View on BrickLink →
          </a>
        </div>
      </div>
    </section>
  );
}
