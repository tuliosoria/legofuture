import { getLegalConfig } from "@/lib/legal-config";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const cfg = getLegalConfig();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Contact</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-4">
        Operated by: <strong>{cfg.operatorName}</strong>
      </p>
      {cfg.contactEmail && (
        <p className="mb-4">
          Email:{" "}
          <a
            href={`mailto:${cfg.contactEmail}`}
            className="text-[hsl(var(--lego-yellow))] hover:underline"
          >
            {cfg.contactEmail}
          </a>
        </p>
      )}
      <p className="mb-4">
        <a
          href={cfg.contactUrl}
          className="text-[hsl(var(--lego-yellow))] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open an issue on GitHub →
        </a>
      </p>
    </div>
  );
}
