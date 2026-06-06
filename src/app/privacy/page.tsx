import { getLegalConfig } from "@/lib/legal-config";
import { BrickCard } from "@/components/ui/BrickCard";
import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-8">Privacy Policy</h1>
      <BrickCard compact className="space-y-6">
        <p className="type-body text-slate-700">
          <strong className="text-jet-black">{cfg.operatorName}</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
          &ldquo;our&rdquo;) provides educational market-analysis tools. This
          policy explains what data we collect and how we use it.
        </p>
        <div>
          <h2 className="type-h3 text-jet-black mb-2">Data we collect</h2>
          <p className="type-body text-slate-700">
            We do not require account creation. Standard server logs may include IP
            addresses and request metadata. We do not sell personal data.
          </p>
        </div>
        <div>
          <h2 className="type-h3 text-jet-black mb-2">Third-party services</h2>
          <p className="type-body text-slate-700">
            We source pricing data from PriceCharting. Forecast pages include a
            BrickLink affiliate link. These services have their own privacy policies.
          </p>
        </div>
        <div>
          <h2 className="type-h3 text-jet-black mb-2">Contact</h2>
          <p className="type-body text-slate-700">
            For privacy inquiries, use{" "}
            <Link href="/contact" className="text-bright-blue hover:underline">
              our contact form
            </Link>
            .
          </p>
        </div>
      </BrickCard>
    </div>
  );
}
