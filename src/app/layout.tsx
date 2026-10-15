import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { FirstVisitDisclaimer } from "@/components/layout/first-visit-disclaimer";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";

const jakarta = Plus_Jakarta_Sans({
  weight: "800",
  subsets: ["latin"],
  variable: "--nf-jakarta",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--nf-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: "500",
  subsets: ["latin"],
  variable: "--nf-mono",
  display: "swap",
});

const SITE_NAME = "BricksFuture";
const SITE_DESCRIPTION =
  "Browse LEGO sets and current offers. Forecasts and sold-price rankings are suspended pending verified data.";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME}: LEGO Set Forecasts`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: LEGO Set Forecasts`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: LEGO Set Forecasts`,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased flex flex-col">
        <GoogleAnalytics />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FirstVisitDisclaimer />
      </body>
    </html>
  );
}
