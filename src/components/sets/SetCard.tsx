import Link from "next/link";
import Image from "next/image";
import { BrickCard } from "@/components/ui/BrickCard";
import { SignalPill } from "@/components/ui/SignalPill";
import { StatusTag } from "@/components/ui/StatusTag";
import { ConfidenceDots } from "@/components/ui/ConfidenceDots";
import type { LegoSet } from "@/lib/domain/lego-set";
import { annualRoiLabel, brickLinkImageUrl, roiPercent } from "@/lib/domain/forecast";

interface Props {
  set: LegoSet;
}

export function SetCard({ set }: Props) {
  const roi = roiPercent(set);
  return (
    <Link
      href={`/set-forecast/${set.id}`}
      className="block focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-bright-blue rounded-card"
    >
      <BrickCard className="h-full hover:-translate-x-px hover:-translate-y-px hover:shadow-click-lg transition-transform">
        <div className="flex items-start justify-between gap-3 mb-3">
          <StatusTag status={set.status} />
          <SignalPill signal={set.signal} size="sm" />
        </div>

        <div className="relative aspect-[4/3] w-full bg-slate-50 rounded-chip overflow-hidden mb-3 border border-slate-100">
          <Image
            src={brickLinkImageUrl(set)}
            alt={set.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain p-3"
            unoptimized
          />
        </div>

        <div className="mb-2">
          <p className="type-caption text-slate-500">
            {set.theme} · #{set.setNumber}
          </p>
          <h3 className="type-h4 mt-0.5 line-clamp-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            {set.name}
          </h3>
        </div>

        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <p className="type-caption text-slate-500">Today</p>
            <p className="type-body font-semibold text-jet-black">${set.currentPrice.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="type-caption text-slate-500">5yr forecast</p>
            <p className="type-body font-semibold text-jet-black">${set.proj5y.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <span className={`type-body-sm font-semibold ${roi >= 0 ? "text-pure-green" : "text-brick-red"}`}>
            {roi >= 0 ? "+" : ""}
            {roi.toFixed(0)}% · {annualRoiLabel(set)}
          </span>
          <ConfidenceDots filled={set.confidence} size="sm" />
        </div>
      </BrickCard>
    </Link>
  );
}
