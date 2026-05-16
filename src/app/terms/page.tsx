export const metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl prose prose-invert">
      <h1>Terms of Use</h1>
      <p>
        LegoFuture provides educational market-analysis tools for informational
        purposes only. Nothing on this site constitutes personalized financial,
        investment, tax, or legal advice.
      </p>
      <h2>No investment advice</h2>
      <p>
        All forecasts are model outputs. Past performance does not guarantee
        future results. You are solely responsible for your investment decisions.
      </p>
      <h2>Accuracy</h2>
      <p>
        Data is sourced from third-party providers and may be inaccurate or
        outdated. Always verify prices and information independently before
        making decisions.
      </p>
      <h2>Trademark notice</h2>
      <p>
        LEGO® is a registered trademark of the LEGO Group. LegoFuture is not
        affiliated with or endorsed by the LEGO Group.
      </p>
    </div>
  );
}
