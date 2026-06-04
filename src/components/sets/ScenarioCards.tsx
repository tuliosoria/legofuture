import { BrickCard } from "@/components/ui/BrickCard";
import type { LegoSet } from "@/lib/domain/lego-set";
import { scenarioRoi } from "@/lib/domain/forecast";

interface Props {
  set: LegoSet;
}

const CARDS: { key: "bear" | "base" | "bull"; label: string; accent: "red" | "blue" | "green"; tone: string }[] = [
  { key: "bear", label: "Bear case", accent: "red", tone: "text-brick-red" },
  { key: "base", label: "Base case", accent: "blue", tone: "text-bright-blue" },
  { key: "bull", label: "Bull case", accent: "green", tone: "text-pure-green" },
];

export function ScenarioCards({ set }: Props) {
  const values = {
    bear: set.bear,
    base: set.proj5y,
    bull: set.bull,
  } as const;
  return (
    <section>
      <h2 className="type-h3 mb-4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
        5yr scenarios
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map(({ key, label, accent, tone }) => {
          const terminal = values[key];
          const roi = scenarioRoi(set.currentPrice, terminal);
          return (
            <BrickCard key={key} accentTop={accent}>
              <p className="type-eyebrow text-slate-500 mb-1">{label}</p>
              <p className={`type-h2 ${tone}`} style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
                ${terminal.toLocaleString()}
              </p>
              <p className={`type-body-sm font-semibold mt-1 ${roi >= 0 ? "text-pure-green" : "text-brick-red"}`}>
                {roi >= 0 ? "+" : ""}{roi.toFixed(0)}% over 5yr
              </p>
              <p className="type-caption text-slate-500 mt-2">
                from today&rsquo;s ${set.currentPrice.toLocaleString()}
              </p>
            </BrickCard>
          );
        })}
      </div>
    </section>
  );
}
