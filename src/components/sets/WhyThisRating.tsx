import { BrickCard } from "@/components/ui/BrickCard";
import { DotsRow } from "@/components/ui/DotsRow";
import type { LegoSet } from "@/lib/domain/lego-set";
import {
  agreementDots,
  cagr5,
  communityDots,
  liquidityDots,
  outlookDots,
  retirementDots,
} from "@/lib/domain/forecast";

const OUTLOOK_COPY = (cagr: number) => {
  const pct = (cagr * 100).toFixed(1);
  if (cagr >= 0.18) return `Exceptional 5yr CAGR (${pct}%/yr) — meaningfully outperforms equities.`;
  if (cagr >= 0.10) return `Strong 5yr CAGR (${pct}%/yr) — comfortably above S&P 500 baseline.`;
  if (cagr >= 0.05) return `Moderate 5yr CAGR (${pct}%/yr) — roughly tracks inflation-plus.`;
  if (cagr >= 0) return `Low expected return (${pct}%/yr) — below market.`;
  return `Negative expected return (${pct}%/yr) — consider waiting.`;
};

const RETIREMENT_COPY: Record<LegoSet["status"], string> = {
  Retired: "Production has ended; secondary supply only.",
  "Retiring soon": "Production winding down; limited entry window.",
  Active: "Still in production at MSRP — appreciation gated on retirement.",
};

const COMMUNITY_COPY = (score: number) => {
  if (score >= 85) return `Top-tier community engagement (${score}/100).`;
  if (score >= 75) return `Strong community signal (${score}/100).`;
  if (score >= 65) return `Healthy community interest (${score}/100).`;
  return `Modest community footprint (${score}/100).`;
};

interface Props {
  set: LegoSet;
}

export function WhyThisRating({ set }: Props) {
  const cagr = cagr5(set);
  return (
    <BrickCard accentTop="blue">
      <h2 className="type-h3 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
        Why this rating
      </h2>
      <p className="type-body-sm text-slate-500 mb-4">
        Five inputs feed the LegoFuture signal. Each is rated independently.
      </p>

      <DotsRow label="5yr outlook" dots={outlookDots(set)} caption={OUTLOOK_COPY(cagr)} />
      <DotsRow
        label="Retirement status"
        dots={retirementDots(set)}
        caption={RETIREMENT_COPY[set.status]}
      />
      <DotsRow
        label="Community strength"
        dots={communityDots(set)}
        caption={COMMUNITY_COPY(set.communityScore)}
      />
      <DotsRow
        label="Market liquidity"
        dots={liquidityDots(set)}
        caption={set.liquidity}
      />
      <DotsRow
        label="Price agreement"
        dots={agreementDots(set)}
        caption={`${set.priceAgreement} of recent comps within ±10% of consensus.`}
      />
    </BrickCard>
  );
}
