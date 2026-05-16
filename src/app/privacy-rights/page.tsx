import { getLegalConfig } from "@/lib/legal-config";
import { BrickCard } from "@/components/ui/BrickCard";

export const metadata = { title: "Privacy Rights" };

export default function PrivacyRightsPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-8">Privacy Rights</h1>
      <BrickCard compact className="space-y-4">
        <p className="type-body text-slate-700">
          Depending on your jurisdiction you may have rights including access,
          deletion, correction, and portability of personal data we hold about you.
        </p>
        <p className="type-body text-slate-700">
          To exercise any privacy right, contact{" "}
          {cfg.privacyEmail ? (
            <a href={`mailto:${cfg.privacyEmail}`} className="text-bright-blue hover:underline">
              {cfg.privacyEmail}
            </a>
          ) : (
            <a href={cfg.contactUrl} target="_blank" rel="noopener noreferrer" className="text-bright-blue hover:underline">
              our contact page
            </a>
          )}
          . We will respond within 30 days.
        </p>
      </BrickCard>
    </div>
  );
}
