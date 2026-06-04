import { BrickCard } from "@/components/ui/BrickCard";
import type { LegoSet } from "@/lib/domain/lego-set";

interface Props {
  set: LegoSet;
}

export function LiveMarketPanel({ set }: Props) {
  const items = [
    { label: "Community", value: set.communityScore == null ? "—" : `${set.communityScore}/100` },
    { label: "Momentum", value: set.momentum ?? "—" },
    { label: "Liquidity", value: set.liquidity },
    { label: "Price agreement", value: set.priceAgreement },
  ];
  return (
    <section>
      <h2 className="type-h3 mb-4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
        Live market signal
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it) => (
          <BrickCard key={it.label} compact>
            <p className="type-caption text-slate-500">{it.label}</p>
            <p className="type-body font-semibold text-jet-black mt-1">{it.value}</p>
          </BrickCard>
        ))}
      </div>
    </section>
  );
}
