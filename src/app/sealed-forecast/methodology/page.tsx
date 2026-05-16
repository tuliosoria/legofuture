import { SectionDivider } from "@/components/ui/SectionDivider";

export default function MethodologyPage() {
  const sections = [
    {
      color: "red" as const,
      id: "what",
      title: "What are we predicting?",
      content: (
        <p>
          We estimate the <strong>5-year projected value</strong> of a sealed (never-opened)
          LEGO set, expressed as a compound annual growth rate (CAGR) and a total return on
          investment (ROI) percentage.
        </p>
      ),
    },
    {
      color: "blue" as const,
      id: "model",
      title: "The Model",
      content: (
        <>
          <p>
            Our MVP uses a <strong>deterministic rules-based model</strong> as a placeholder for
            a trained XGBoost regressor (coming in a future update). The rules are derived from
            historical LEGO secondary-market patterns:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li><strong>Retired sets:</strong> Base CAGR of 8%, plus up to 5% extra for set age (0.5% per year after retirement, capped at 5%).</li>
            <li><strong>Current sets:</strong> Base CAGR of 3% while still in production.</li>
            <li><strong>GWP / promotional sets:</strong> 4% CAGR baseline.</li>
            <li><strong>Already-run-up sets</strong> (current price &gt;2× MSRP): CAGR multiplied by 0.75 to account for limited remaining upside.</li>
            <li><strong>Under-valued sets</strong> (current price &lt;0.9× MSRP): CAGR gets +1% bonus.</li>
          </ul>
        </>
      ),
    },
    {
      color: "green" as const,
      id: "scenarios",
      title: "Scenarios",
      content: (
        <>
          <p>Each forecast includes three scenarios to communicate uncertainty:</p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li><strong>Optimist (1.5×):</strong> Assumes strong demand, early retirement, or collector hype.</li>
            <li><strong>Moderate (1×):</strong> The base estimate — our best guess.</li>
            <li><strong>Pessimist (0.5×):</strong> Accounts for poor liquidity, market saturation, or prolonged production runs.</li>
          </ul>
        </>
      ),
    },
    {
      color: "yellow" as const,
      id: "pricing",
      title: "Pricing Data",
      content: (
        <p>
          Current prices are sourced from{" "}
          <a href="https://www.pricecharting.com" target="_blank" rel="noopener noreferrer" className="text-bright-blue hover:underline">
            PriceCharting.com
          </a>
          . We use the &ldquo;new&rdquo; (sealed) price tier wherever available. Data is cached
          in our catalog and refreshed periodically.
        </p>
      ),
    },
    {
      color: "red" as const,
      id: "signals",
      title: "Investment Signals",
      content: (
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Buy:</strong> Moderate-scenario CAGR &gt; 7% — market-beating expected return.</li>
          <li><strong>Hold:</strong> CAGR between 3–7% — broadly in line with inflation/equities.</li>
          <li><strong>Sell:</strong> CAGR &lt; 3% or set is younger than 12 months (insufficient track record).</li>
        </ul>
      ),
    },
    {
      color: "blue" as const,
      id: "limitations",
      title: "Limitations",
      content: (
        <p>
          This model is for informational purposes only. LEGO set values are subject to
          unpredictable factors: licensing changes, re-releases, economic conditions, and
          collector trends. Past appreciation does not guarantee future returns. Never invest
          more than you can afford to lose.
        </p>
      ),
    },
  ];

  return (
    <main>
      {/* Page title band */}
      <div className="bg-pure-white border-b-2 border-jet-black px-4 py-10">
        <div className="mx-auto max-w-[1240px]">
          <p className="type-eyebrow text-slate-500 mb-2">How it works</p>
          <h1 className="type-display-2 text-jet-black">How our forecast works.</h1>
        </div>
      </div>

      {/* Alternating sections */}
      {sections.map((section, i) => (
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
