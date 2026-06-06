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
  if (cagr >= 0.18) return `Strong 5yr CAGR (${pct}%/yr). Well above equities.`;
  if (cagr >= 0.10) return `Solid 5yr CAGR (${pct}%/yr). Above the S&P 500 baseline.`;
  if (cagr >= 0.05) return `Moderate 5yr CAGR (${pct}%/yr). Roughly inflation-plus.`;
  if (cagr >= 0) return `Low expected return (${pct}%/yr). Below market.`;
  return `Negative expected return (${pct}%/yr). Consider waiting.`;
};

const RETIREMENT_COPY: Record<LegoSet["status"], string> = {
  Retired: "Production has ended; secondary supply only.",
  "Retiring soon": "Production winding down; limited entry window.",
  Active: "Still in production at MSRP. Return is gated on retirement.",
};

const COMMUNITY_COPY = (score: number | null) => {
  if (score == null) return "Community signal pending data.";
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
        Five inputs feed the BricksFuture signal. Each is rated independently.
      </p>

      <DotsRow
        label="5yr outlook"
        dots={outlookDots(set)}
        caption={OUTLOOK_COPY(cagr)}
        tooltip="XGBoost model predicts a 5-year price from the set's features. Training labels are extrapolated from each set's trailing annualised return because PriceCharting history is typically only 12 to 36 months. See the methodology page for full caveats."
      />
      <DotsRow
        label="Retirement status"
        dots={retirementDots(set)}
        caption={RETIREMENT_COPY[set.status]}
        tooltip="Retired sets score 5 dots (supply only shrinks), Retiring soon scores 3 (near-term catalyst), Active scores 2 (return gated on retirement timing)."
      />
      <DotsRow
        label="Community strength"
        dots={communityDots(set)}
        caption={COMMUNITY_COPY(set.communityScore)}
        tooltip="0-100 score blending Brick Insights aggregate rating (50%), Google Trends search interest (25%), and Reddit mention volume × engagement (25%). Missing signals are redistributed pro-rata. Bucketed into 1-5 dots at 50 / 65 / 75 / 85."
      />
      <DotsRow
        label="Market liquidity"
        dots={liquidityDots(set)}
        caption={set.liquidity}
        tooltip="How fast you can sell at consensus price, derived from the rolling count of eBay sold-listings over the past 90 days. More listings = higher dots."
      />
      <DotsRow
        label="Price agreement"
        dots={agreementDots(set)}
        caption={`${set.priceAgreement} of recent comps within ±10% of consensus.`}
        tooltip="Share of recent eBay sold comps that closed within ±10% of the consensus price. High agreement means the market is converged and the quoted price is reliable."
      />
    </BrickCard>
  );
}
