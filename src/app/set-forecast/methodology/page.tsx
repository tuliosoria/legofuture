import type { Metadata } from "next";
import { SectionDivider } from "@/components/ui/SectionDivider";

export const metadata: Metadata = {
  title: "How LegoFuture Forecasts Work | LegoFuture",
  description:
    "Plain-English overview of the data sources, scenarios, signals, and confidence ratings behind LegoFuture set forecasts.",
};

export default function MethodologyPage() {
  const sections = [
    {
      color: "red" as const,
      id: "sources",
      title: "Where the data comes from",
      content: (
        <>
          <p>
            We pull from four public sources and combine them into a single
            forecast for every set in our catalog.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>
              <strong>PriceCharting</strong> — sealed, complete, and loose set
              prices, current and historical.
            </li>
            <li>
              <strong>Rebrickable</strong> — set metadata: themes, piece counts,
              minifigs, retirement years.
            </li>
            <li>
              <strong>Community</strong> — Reddit mentions across r/lego,
              r/legomarket, and r/legomania.
            </li>
            <li>
              <strong>Google Trends</strong> — search interest in the set or
              theme over time.
            </li>
          </ul>
        </>
      ),
    },
    {
      color: "blue" as const,
      id: "scenarios",
      title: "Three scenarios per set",
      content: (
        <>
          <p>
            Every forecast comes in three flavors so you can see the full range
            of what could happen, not just one guess.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>
              <strong>Pessimist</strong> — what the price might do if demand
              softens, the set sticks around at retail, or the market cools
              broadly.
            </li>
            <li>
              <strong>Moderate</strong> — our base-case estimate, in line with
              how similar sets have behaved historically.
            </li>
            <li>
              <strong>Optimist</strong> — what could happen if the set retires
              early, collector interest accelerates, or a related franchise
              catches fire.
            </li>
          </ul>
        </>
      ),
    },
    {
      color: "green" as const,
      id: "signals",
      title: "Buy, Hold, or Sell",
      content: (
        <>
          <p>
            Each set gets a single plain recommendation based on its
            moderate-scenario projection.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>
              <strong>Buy</strong> — projected appreciation comfortably exceeds
              what cash or a broad index would earn.
            </li>
            <li>
              <strong>Hold</strong> — projected appreciation roughly keeps pace
              with the broader market.
            </li>
            <li>
              <strong>Sell</strong> — projected appreciation is flat or
              negative; the cash could likely work harder elsewhere.
            </li>
          </ul>
        </>
      ),
    },
    {
      color: "yellow" as const,
      id: "confidence",
      title: "High, Medium, or Low confidence",
      content: (
        <>
          <p>
            Confidence tells you how much weight to give the forecast. It
            reflects how much historical data we have, how many similar sets we
            can compare against, and whether our signals agree with each other.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-3">
            <li>
              <strong>High</strong> — long price history, lots of comparable
              sets, signals pointing the same direction.
            </li>
            <li>
              <strong>Medium</strong> — enough history to be useful, but some
              signals disagree or peer data is thin.
            </li>
            <li>
              <strong>Low</strong> — thin price history or conflicting signals.
              Treat the forecast as a rough indication, not a hard call.
            </li>
          </ul>
        </>
      ),
    },
    {
      color: "red" as const,
      id: "limits",
      title: "What this is — and isn't",
      content: (
        <p>
          LegoFuture is informational. Forecasts are model estimates — not
          guarantees. LEGO set values can be moved by re-releases, licensing
          news, broader economic conditions, and collector trends none of us
          can predict. Always verify prices before buying or selling.
        </p>
      ),
    },
  ];

  return (
    <main>
      <div className="bg-pure-white border-b-2 border-jet-black px-4 py-10">
        <div className="mx-auto max-w-[1240px]">
          <p className="type-eyebrow text-slate-500 mb-2">How it works</p>
          <h1 className="type-display-2 text-jet-black">
            How our forecast works.
          </h1>
          <p className="type-body-lg text-slate-700 max-w-2xl mt-3">
            A plain-English overview of the data, scenarios, and signals
            behind every LegoFuture forecast.
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          <SectionDivider color={section.color} />
          <section className="px-4 py-12 bg-paper" id={section.id}>
            <div className="mx-auto max-w-3xl">
              <h2 className="type-h2 text-jet-black mb-4">{section.title}</h2>
              <div className="type-body text-slate-700 leading-relaxed space-y-3">
                {section.content}
              </div>
            </div>
          </section>
        </div>
      ))}
    </main>
  );
}
