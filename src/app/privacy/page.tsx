import { getLegalConfig } from "@/lib/legal-config";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl prose prose-invert">
      <h1>Privacy Policy</h1>
      <p>
        <strong>{cfg.operatorName}</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
        &ldquo;our&rdquo;) provides educational market-analysis tools. This
        policy explains what data we collect and how we use it.
      </p>
      <h2>Data we collect</h2>
      <p>
        We do not require account creation. Standard server logs may include IP
        addresses and request metadata. We do not sell personal data.
      </p>
      <h2>Third-party services</h2>
      <p>
        We source pricing data from PriceCharting. Forecast pages include a
        BrickLink affiliate link. These services have their own privacy policies.
      </p>
      <h2>Contact</h2>
      {cfg.privacyEmail && (
        <p>
          Privacy inquiries:{" "}
          <a href={`mailto:${cfg.privacyEmail}`}>{cfg.privacyEmail}</a>
        </p>
      )}
    </div>
  );
}
