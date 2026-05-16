import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.rebrickable.com",
        pathname: "/media/sets/**",
      },
    ],
  },
};

export default nextConfig;
