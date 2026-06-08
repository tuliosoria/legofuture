import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology · BricksFuture",
  description:
    "How BricksFuture's 5-year forecasts, composite scores, and signals are built. Data sources, weighting, and honest limitations.",
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <p className="type-eyebrow text-slate-500">Methodology</p>
      <h1
        className="type-h1 mt-2 mb-6"
        style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
      >
        How our forecasts work
      </h1>

      <div className="prose prose-slate max-w-none type-body text-slate-700 space-y-4">
        <p>
          BricksFuture publishes a 5-year price forecast for every set in our catalog. Forecasts are
          produced by an open-source machine-learning model (gradient-boosted trees, XGBoost) trained
          on three families of inputs: <strong>price history</strong> (monthly sealed comps from
          PriceCharting plus recent eBay and BrickLink sold transactions),{" "}
          <strong>set fundamentals</strong> (theme, piece count, release year, MSRP, retirement
          status), and <strong>community engagement</strong> (Brick Insights ratings, Google Trends
          search interest, and Reddit mention volume). Every set ships with a base-case projection
          plus bear and bull scenarios so you can see the realistic range, not just a single number.
        </p>

        <h2 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          Inputs
        </h2>

        <h3 className="type-h4 mt-4" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 700 }}>
          Raw data sources
        </h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>PriceCharting:</strong> monthly sealed price snapshots, typically 12 to 36 months of history per set.</li>
          <li><strong>BrickLink sold comps:</strong> recent secondary-market transaction prices.</li>
          <li><strong>eBay completed listings:</strong> actual sale prices (not asks) for sealed sets.</li>
          <li><strong>Rebrickable + LEGO catalog:</strong> set metadata (theme, piece count, release year, MSRP).</li>
          <li><strong>Retirement status:</strong> active, retiring-soon, or retired, sourced from LEGO.com and curated trackers.</li>
          <li><strong>Brick Insights, Google Trends, Reddit:</strong> community engagement signals.</li>
        </ul>

        <h3 className="type-h4 mt-6" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 700 }}>
          Derived signals
        </h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Community strength:</strong> Brick Insights aggregate rating (50%), Google Trends monthly search interest (25%), Reddit mention volume × engagement (25%). Components are optional; missing signals are redistributed pro-rata. Synced monthly.</li>
          <li><strong>Market liquidity:</strong> active listing depth as a proxy for how easy a set is to sell.</li>
          <li><strong>Price agreement:</strong> dispersion of recent sold comps around the consensus price. Tight clusters = high confidence.</li>
          <li><strong>Trailing annualised return:</strong> the slope of the set&rsquo;s observed price history.</li>
        </ul>

        <p className="mt-4 text-slate-700">
          Prices and signals update hourly. The ML model retrains weekly on the latest available data.
        </p>

        <h3 className="type-h4 mt-6" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 700 }}>
          How much history we actually have
        </h3>
        <p>
          Across the catalog, most sets only have 12 to 24 months of usable price history.
          That means the model is, in practice, learning a fairly simple pattern: sets
          that have trended up recently, in a theme where similar sets have also trended
          up, tend to keep trending up. There is no deep multi-cycle history for any
          individual set. We disclose this so you know the model is not divining
          long-cycle behaviour from data that does not exist.
        </p>

        <h2 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          Composite score
        </h2>
        <p>
          The composite score is a single 0-100 summary of the inputs above. It is not a
          new layer of data, it is a weighted rollup so you can rank sets at a glance.
          Weights are: forecast CAGR (35%), retirement status (25%), community strength
          (20%), and market liquidity + price agreement (20%). Retirement status appears
          in the input list and in the composite weights because it is both a raw fact
          about a set and a major driver of the ranking, not because it is counted twice.
        </p>

        <p className="mt-3">
          Sets are then mapped to one of five signals:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Strong Buy:</strong> top composite score plus a near-term catalyst (retiring soon, sharp recent price acceleration, or a clean entry price below trailing trend). Best risk-adjusted entry right now.</li>
          <li><strong>Buy:</strong> solid composite score, healthy forecast, no obvious catalyst yet. A reasonable accumulation candidate.</li>
          <li><strong>Watch:</strong> the set looks interesting but the entry price is wrong today. Add to your list and wait for a price trigger.</li>
          <li><strong>Hold:</strong> if you already own it, keep it. If you don&rsquo;t, there are better buys. Neutral, not negative.</li>
          <li><strong>Sell:</strong> forecast and signals point down. Consider exiting.</li>
        </ul>

        <h2 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          About the &ldquo;5-year&rdquo; horizon
        </h2>
        <p>
          We project prices five years out, but you should know how that target is built.
          PriceCharting history typically goes back 12 to 36 months per set, which means
          no LEGO set has enough public price data to back-test an actual 5-year forward
          return. So our training labels are constructed by taking each set&rsquo;s observed
          trailing annualised return and extrapolating it linearly to a 5-year log-return
          target. The XGBoost model then learns how a set&rsquo;s features (theme, pieces,
          age, retirement status, community signal, price agreement, liquidity) map to
          that target.
        </p>
        <p className="mt-3">
          In plain terms: the &ldquo;5-year forecast&rdquo; is a 5-year projection of the
          currently observed price trend, conditioned on the set&rsquo;s features. It is
          not a back-tested 5-year return. As the history pipeline accumulates more
          months of real data per set, we will retrain on increasingly genuine
          multi-year targets and update this section.
        </p>

        <h2 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          What we don&rsquo;t do
        </h2>
        <p>
          We do not give individualised financial advice. We do not guarantee returns. We do not
          account for taxes, transaction costs, storage costs, or condition risk. Forecasts are
          educational starting points. Always do your own research before buying.
        </p>

        <h2 className="type-h3 mt-8" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
          Disclosures
        </h2>
        <p>
          BricksFuture earns affiliate commissions on qualifying eBay purchases originated from links on
          this site. LEGO® is a trademark of the LEGO Group; BricksFuture is not affiliated with, endorsed
          by, or sponsored by the LEGO Group.
        </p>
      </div>
    </main>
  );
}
