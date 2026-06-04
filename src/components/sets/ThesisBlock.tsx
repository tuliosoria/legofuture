import { BrickCard } from "@/components/ui/BrickCard";
import type { LegoSet } from "@/lib/domain/lego-set";

interface Props {
  set: LegoSet;
}

export function ThesisBlock({ set }: Props) {
  return (
    <section>
      <BrickCard accentTop="yellow">
        <h2
          className="type-h3 mb-3"
          style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
        >
          Investment thesis
        </h2>
        <p className="type-body text-slate-700 leading-relaxed">{set.thesis}</p>
        <p className="type-caption text-slate-500 mt-4 leading-relaxed">
          Forecasts are educational estimates derived from historical price patterns, retirement status, and
          community signal. Not investment advice. Past performance does not guarantee future results. Do your
          own research before buying.
        </p>
      </BrickCard>
    </section>
  );
}
