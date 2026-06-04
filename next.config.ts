import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/server/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.rebrickable.com",
        pathname: "/media/sets/**",
      },
      { protocol: "https", hostname: "www.pricecharting.com" },
      { protocol: "https", hostname: "img.bricklink.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/sealed-forecast", destination: "/set-forecast", permanent: true },
      { source: "/sealed-forecast/:path*", destination: "/set-forecast/:path*", permanent: true },
      { source: "/api/sealed/:path*", destination: "/api/sets/:path*", permanent: true },
      // MVP rebuild redirects (2026-06-03)
      { source: "/watchlist", destination: "/buying-list", permanent: true },
      { source: "/set-forecast/methodology", destination: "/contact#methodology", permanent: true },
      { source: "/set/:slug*", destination: "/set-forecast/:slug*", permanent: true },
      { source: "/legal", destination: "/terms", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
