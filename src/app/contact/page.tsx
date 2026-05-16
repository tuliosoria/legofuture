import { getLegalConfig } from "@/lib/legal-config";
import { BrickCard } from "@/components/ui/BrickCard";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <p className="type-eyebrow text-slate-500 mb-2">Get in touch</p>
      <h1 className="type-display-2 text-jet-black mb-8">Contact</h1>
      <BrickCard compact>
        <p className="type-body text-slate-700 mb-4">
          Operated by: <strong className="text-jet-black">{cfg.operatorName}</strong>
        </p>
        {cfg.contactEmail && (
          <p className="type-body text-slate-700 mb-4">
            Email:{" "}
            <a href={`mailto:${cfg.contactEmail}`} className="text-bright-blue hover:underline">
              {cfg.contactEmail}
            </a>
          </p>
        )}
        <p className="type-body text-slate-700">
          <a
            href={cfg.contactUrl}
            className="text-bright-blue hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open an issue on GitHub →
          </a>
        </p>
      </BrickCard>
    </div>
  );
}
