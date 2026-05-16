import { getLegalConfig } from "@/lib/legal-config";

export const metadata = { title: "Privacy Rights" };

export default function PrivacyRightsPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl prose prose-invert">
      <h1>Privacy Rights</h1>
      <p>
        Depending on your jurisdiction you may have rights including access,
        deletion, correction, and portability of personal data we hold about
        you.
      </p>
      <p>
        To exercise any privacy right, contact{" "}
        {cfg.privacyEmail ? (
          <a href={`mailto:${cfg.privacyEmail}`}>{cfg.privacyEmail}</a>
        ) : (
          <a href={cfg.contactUrl} target="_blank" rel="noopener noreferrer">
            our contact page
          </a>
        )}
        . We will respond within 30 days.
      </p>
    </div>
  );
}
