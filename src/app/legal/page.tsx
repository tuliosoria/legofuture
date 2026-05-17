import Link from "next/link";
import { BrickCard } from "@/components/ui/BrickCard";

export const metadata = { title: "Legal" };

const links = [
  { href: "/terms", title: "Terms of Use", desc: "How you may use LegoFuture and the limits of our liability." },
  { href: "/privacy", title: "Privacy Policy", desc: "What data we collect, how it is used, and how to contact us." },
  { href: "/privacy-rights", title: "Privacy Rights", desc: "Your rights under GDPR, CCPA, and other privacy regimes." },
  { href: "/contact", title: "Contact", desc: "How to reach the LegoFuture team for legal inquiries." },
];

export default function LegalPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <p className="type-eyebrow text-slate-500 mb-2">Legal</p>
      <h1 className="type-display-2 text-jet-black mb-8">Legal</h1>
      <BrickCard compact className="space-y-4">
        {links.map((l) => (
          <div key={l.href}>
            <Link href={l.href} className="type-h3 text-jet-black hover:underline">
              {l.title}
            </Link>
            <p className="type-body text-slate-700">{l.desc}</p>
          </div>
        ))}
      </BrickCard>
    </div>
  );
}
