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
    ],
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
