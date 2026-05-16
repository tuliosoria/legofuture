import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] mt-auto">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          <div>
            <h3 className="font-bold text-sm mb-3 text-[hsl(var(--lego-yellow))]">LegoFuture</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              Educational forecasting tools for sealed LEGO sets. Not financial
              advice. Do your own research.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-sm mb-3">Tools</h3>
            <ul className="space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
              <li>
                <Link href="/sealed-forecast" className="hover:text-[hsl(var(--lego-yellow))] transition-colors">
                  Sealed Forecast
                </Link>
              </li>
              <li>
                <Link href="/sealed-forecast/methodology" className="hover:text-[hsl(var(--lego-yellow))] transition-colors">
                  Methodology
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-sm mb-3">Legal</h3>
            <ul className="space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
              <li>
                <Link href="/terms" className="hover:text-[hsl(var(--lego-yellow))] transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[hsl(var(--lego-yellow))] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/privacy-rights" className="hover:text-[hsl(var(--lego-yellow))] transition-colors">
                  Privacy Rights
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[hsl(var(--lego-yellow))] transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))] pt-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          <p>© {year} LegoFuture. Educational tools only — not financial advice.</p>
          <p className="mt-1">
            LEGO is a trademark of the LEGO Group. LegoFuture is not affiliated with or endorsed by the LEGO Group.
          </p>
        </div>
      </div>
    </footer>
  );
}
