import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { TrendingUp, Package, BarChart3, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-[hsl(var(--lego-yellow))] blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-[hsl(var(--lego-red))] blur-3xl" />
          <div className="absolute top-40 right-1/3 w-24 h-24 rounded-full bg-[hsl(var(--lego-blue))] blur-2xl" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center max-w-3xl">
          <div className="animate-fade-in-up">
            <span className="inline-block text-xs font-semibold bg-[hsl(var(--lego-yellow))] text-zinc-900 rounded-full px-4 py-1.5 mb-6 shadow-md">
              Free &middot; No login required &middot; Educational tools only
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] animate-fade-in-up delay-100">
            <span className="text-white">Forecast sealed</span>
            <br />
            <span className="text-[hsl(var(--lego-yellow))] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              LEGO appreciation
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
            Buy&thinsp;/&thinsp;hold&thinsp;/&thinsp;sell signals on 20+ popular
            sealed sets — Star Wars UCS, Technic, Architecture, Modular Buildings,
            and more. Educational tools, not investment advice.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-300">
            <Link href="/sealed-forecast">
              <Button
                size="lg"
                className="text-base px-10 py-3 bg-[hsl(var(--lego-yellow))] text-zinc-900 hover:brightness-110 shadow-lg hover-scale"
              >
                Open Forecast →
              </Button>
            </Link>
            <Link href="/sealed-forecast/methodology">
              <Button
                size="lg"
                variant="outline"
                className="text-base px-10 py-3 border-white/30 text-white hover:bg-white/10 hover-scale"
              >
                How it works
              </Button>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[hsl(var(--background))] to-transparent" />
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-[hsl(var(--background))]">
        <div className="container mx-auto px-4 max-w-5xl">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                <span className="text-[hsl(var(--lego-yellow))]">Signals</span>{" "}
                built for LEGO investors
              </h2>
              <p className="text-[hsl(var(--muted-foreground))] max-w-xl mx-auto">
                Whether you&rsquo;re stacking retired UCS sets or watching current
                Technic releases, we surface the data you need.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <TrendingUp className="w-6 h-6 text-emerald-400" />,
                title: "5-Year Projections",
                desc: "See pessimist, moderate, and optimist scenarios for every set.",
              },
              {
                icon: <Package className="w-6 h-6 text-[hsl(var(--lego-yellow))]" />,
                title: "20+ Sets Covered",
                desc: "Star Wars, Technic, Architecture, Modular Buildings, Ideas, GWPs, and more.",
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-[hsl(var(--lego-blue))]" />,
                title: "Live Pricing",
                desc: "Prices sourced live from PriceCharting with a bundled fallback snapshot.",
              },
              {
                icon: <Clock className="w-6 h-6 text-[hsl(var(--lego-red))]" />,
                title: "Retirement Status",
                desc: "Filter by retired vs. current to find sets with supply-constrained upside.",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 100}>
                <div className="hover-lift rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 h-full">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-[hsl(var(--card))]">
        <div className="container mx-auto px-4 max-w-4xl">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">How it works</h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                From search to decision in seconds.
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Browse the catalog",
                desc: "Filter by theme, status, or recommendation signal. Search by set name or number.",
              },
              {
                step: "2",
                title: "Review the forecast",
                desc: "See a 5-year projection chart, scenario range, key drivers, and the model's reasoning.",
              },
              {
                step: "3",
                title: "Make your own call",
                desc: "Use the analysis as one input. LegoFuture is an educational tool, not personalized advice.",
              },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 150}>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-[hsl(var(--lego-yellow))] text-zinc-900 text-lg font-bold flex items-center justify-center mx-auto mb-4 shadow-md">
                    {item.step}
                  </div>
                  <h3 className="font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[hsl(var(--background))]">
        <FadeIn>
          <div className="container mx-auto px-4 text-center max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to invest smarter in LEGO?
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] mb-8">
              No sign-up. No paywall. Informational tools only.
            </p>
            <Link href="/sealed-forecast">
              <Button
                size="lg"
                className="text-base px-10 py-3 bg-[hsl(var(--lego-yellow))] text-zinc-900 hover:brightness-110 shadow-lg hover-scale"
              >
                Open Sealed Forecast →
              </Button>
            </Link>
            <div className="mt-8 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4 text-left text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
              LegoFuture provides educational market-analysis tools for informational
              purposes only. It does not provide personalized financial, investment,
              tax, or legal advice. LEGO® is a trademark of the LEGO Group.
              LegoFuture is not affiliated with or endorsed by the LEGO Group.
              Review our{" "}
              <Link href="/terms" className="text-[hsl(var(--lego-yellow))] hover:underline">
                Terms of Use
              </Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-[hsl(var(--lego-yellow))] hover:underline">
                Privacy Policy
              </Link>
              {" "}before relying on this site.
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
