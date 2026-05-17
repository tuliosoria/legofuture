import { getLegalConfig } from "@/lib/legal-config";
import { BrickCard } from "@/components/ui/BrickCard";

export const metadata = { title: "Terms of Use" };

export default function TermsPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-8">Terms of Use</h1>
      <BrickCard compact className="space-y-6">
        <p className="type-body text-slate-700">
          <strong className="text-jet-black">{cfg.operatorName}</strong> provides educational market-analysis tools for informational
          purposes only. Nothing on this site constitutes personalized financial,
          investment, tax, or legal advice.
        </p>
        <div>
          <h2 className="type-h3 text-jet-black mb-2">No investment advice</h2>
          <p className="type-body text-slate-700">
            All forecasts are model outputs. Past performance does not guarantee
            future results. You are solely responsible for your investment decisions.
          </p>
        </div>
        <div>
          <h2 className="type-h3 text-jet-black mb-2">Accuracy</h2>
          <p className="type-body text-slate-700">
            Data is sourced from third-party providers and may be inaccurate or
            outdated. Always verify prices and information independently before
            making decisions.
          </p>
        </div>
        <div>
          <h2 className="type-h3 text-jet-black mb-2">Trademark notice</h2>
          <p className="type-body text-slate-700">
            LEGO® is a registered trademark of the LEGO Group. {cfg.operatorName} is not
            affiliated with or endorsed by the LEGO Group.
          </p>
        </div>
      </BrickCard>
    </div>
  );
}
