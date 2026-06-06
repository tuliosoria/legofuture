import type { Metadata } from "next";
import Link from "next/link";
import { BrickCard } from "@/components/ui/BrickCard";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact · LegoFuture",
  description:
    "Get in touch with the LegoFuture team. Questions, set requests, and partnership inquiries.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 md:px-8 py-10">
      <p className="type-eyebrow text-slate-500">Contact</p>
      <h1
        className="type-h1 mt-2 mb-8"
        style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
      >
        Get in touch
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8">
        <BrickCard accentTop="red">
          <h2 className="type-h3 mb-3" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
            Send us a message
          </h2>
          <p className="type-body-sm text-slate-700 mb-4">
            Questions, set requests, partnership inquiries. We read everything.
          </p>
          <ContactForm />
        </BrickCard>

        <div>
          <BrickCard accentTop="green" className="mb-4">
            <h3 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
              Methodology
            </h3>
            <p className="type-body-sm text-slate-700">
              Curious how the forecasts are built? See the full{" "}
              <Link href="/methodology" className="text-bright-blue underline">
                methodology page
              </Link>
              .
            </p>
          </BrickCard>
          <BrickCard accentTop="yellow">
            <h3 className="type-h4 mb-2" style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}>
              Legal
            </h3>
            <ul className="space-y-2 type-body-sm">
              <li><Link href="/terms" className="text-bright-blue underline">Terms of use</Link></li>
              <li><Link href="/privacy" className="text-bright-blue underline">Privacy policy</Link></li>
              <li><Link href="/privacy-rights" className="text-bright-blue underline">Privacy rights / Do not sell</Link></li>
            </ul>
          </BrickCard>
        </div>
      </div>
    </main>
  );
}
