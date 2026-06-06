import { BrickCard } from "@/components/ui/BrickCard";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { LegoSet } from "@/lib/domain/lego-set";

interface Props {
  set: LegoSet;
}

export function LiveMarketPanel({ set }: Props) {
  const items: { label: string; value: string; tooltip: string }[] = [
    {
      label: "Community",
      value: set.communityScore == null ? "—" : `${set.communityScore}/100`,
      tooltip:
        "0-100 score blending Brick Insights aggregate rating (50%), Google Trends search interest (25%), and Reddit mention volume × engagement (25%). Each component is optional; missing signals are redistributed pro-rata.",
    },
    {
      label: "Momentum",
      value: set.momentum ?? "—",
      tooltip:
        "12-month price change computed from the trailing PriceCharting sealed-price history. Positive means the market has been bidding the set up.",
    },
    {
      label: "Liquidity",
      value: set.liquidity,
      tooltip:
        "How fast you can sell at consensus price, derived from the rolling count of eBay sold-listings over the past 90 days.",
    },
    {
      label: "Price agreement",
      value: set.priceAgreement,
      tooltip:
        "Share of recent eBay sold comps that closed within ±10% of consensus. High agreement means the quoted price is reliable.",
    },
  ];
  return (
    <section>
      <h2 className="type-h3 mb-4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
        Live market signal
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it) => (
          <BrickCard key={it.label} compact>
            <p className="type-caption text-slate-500">
              {it.label}
              <InfoTooltip label={it.label}>{it.tooltip}</InfoTooltip>
            </p>
            <p className="type-body font-semibold text-jet-black mt-1">{it.value}</p>
          </BrickCard>
        ))}
      </div>
    </section>
  );
}
