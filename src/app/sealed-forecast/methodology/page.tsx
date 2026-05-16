export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-3xl font-extrabold">How Our Forecast Works</h1>
      <div className="prose prose-invert max-w-none text-sm leading-relaxed space-y-6 text-[hsl(var(--muted-foreground))]">
        <section>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            What are we predicting?
          </h2>
          <p>
            We estimate the <strong>5-year projected value</strong> of a sealed (never-opened)
            LEGO set, expressed as a compound annual growth rate (CAGR) and a total return on
            investment (ROI) percentage.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            The Model
          </h2>
          <p>
            Our MVP uses a <strong>deterministic rules-based model</strong> as a placeholder for
            a trained XGBoost regressor (coming in a future update). The rules are derived from
            historical LEGO secondary-market patterns:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Retired sets:</strong> Base CAGR of 8%, plus up to 5% extra for set age
              (0.5% per year after retirement, capped at 5%).
            </li>
            <li>
              <strong>Current sets:</strong> Base CAGR of 3% while still in production.
            </li>
            <li>
              <strong>GWP / promotional sets:</strong> 4% CAGR baseline.
            </li>
            <li>
              <strong>Already-run-up sets</strong> (current price &gt;2× MSRP): CAGR multiplied by
              0.75 to account for limited remaining upside.
            </li>
            <li>
              <strong>Under-valued sets</strong> (current price &lt;0.9× MSRP): CAGR gets +1%
              bonus.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Scenarios</h2>
          <p>
            Each forecast includes three scenarios to communicate uncertainty:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Optimist (1.5×):</strong> Assumes strong demand, early retirement, or
              collector hype.
            </li>
            <li>
              <strong>Moderate (1×):</strong> The base estimate — our best guess.
            </li>
            <li>
              <strong>Pessimist (0.5×):</strong> Accounts for poor liquidity, market saturation, or
              prolonged production runs.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Pricing Data
          </h2>
          <p>
            Current prices are sourced from{" "}
            <a
              href="https://www.pricecharting.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--lego-yellow))] hover:underline"
            >
              PriceCharting.com
            </a>
            . We use the &ldquo;new&rdquo; (sealed) price tier wherever available. Data is cached
            in our catalog and refreshed periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Investment Signals
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Buy:</strong> Moderate-scenario CAGR &gt; 7% — market-beating expected return.
            </li>
            <li>
              <strong>Hold:</strong> CAGR between 3–7% — broadly in line with inflation/equities.
            </li>
            <li>
              <strong>Sell:</strong> CAGR &lt; 3% or set is younger than 12 months
              (insufficient track record).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Limitations</h2>
          <p>
            This model is for informational purposes only. LEGO set values are subject to
            unpredictable factors: licensing changes, re-releases, economic conditions, and
            collector trends. Past appreciation does not guarantee future returns. Never invest
            more than you can afford to lose.
          </p>
        </section>
      </div>
    </main>
  );
}
