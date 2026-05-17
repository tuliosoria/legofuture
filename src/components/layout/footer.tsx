import Link from "next/link";
import { SectionDivider } from "@/components/ui/SectionDivider";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <SectionDivider color="black" />
      <div className="bg-jet-black text-paper">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <p
                className="type-h3 text-sunshine-yellow mb-2"
                style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
              >
                LegoFuture
              </p>
              <p className="type-body-sm text-slate-300 leading-relaxed">
                Educational forecasting tools for LEGO sets.
                Not financial advice. Do your own research.
              </p>
              <p className="mt-4 type-body-sm text-slate-500 leading-relaxed">
                Inspired by classic building bricks. Not affiliated with The LEGO Group.
              </p>
            </div>

            {/* Nav */}
            <div>
              <p className="type-eyebrow text-slate-500 mb-3">Tools</p>
              <ul className="space-y-2">
                <li>
                  <Link href="/set-forecast" className="type-body-sm text-slate-300 hover:text-paper hover:underline transition-colors">
                    Set Forecast
                  </Link>
                </li>
                <li>
                  <Link href="/set-forecast/methodology" className="type-body-sm text-slate-300 hover:text-paper hover:underline transition-colors">
                    Methodology
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="type-eyebrow text-slate-500 mb-3">Legal</p>
              <ul className="space-y-2">
                {[
                  { href: "/legal", label: "Legal Overview" },
                  { href: "/terms", label: "Terms of Use" },
                  { href: "/privacy", label: "Privacy Policy" },
                  { href: "/privacy-rights", label: "Privacy Rights" },
                  { href: "/contact", label: "Contact" },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="type-body-sm text-slate-300 hover:text-paper hover:underline transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-6 text-center">
            <p className="type-body-sm text-slate-500">
              © {year} LegoFuture. Educational tools only — not financial advice.
            </p>
            <p className="mt-1 type-body-sm text-slate-500">
              LEGO is a trademark of the LEGO Group. LegoFuture is not affiliated with or endorsed by the LEGO Group.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
