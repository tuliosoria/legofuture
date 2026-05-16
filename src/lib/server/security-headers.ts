// Security response headers applied to every route by Next.js.

export function buildSecurityHeaders(): Array<{
  key: string;
  value: string;
}> {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://cdn.rebrickable.com https://www.pricecharting.com https://www.google-analytics.com https://*.googletagmanager.com",
        "connect-src 'self' https://www.pricecharting.com https://trends.google.com https://www.google-analytics.com https://*.analytics.google.com https://*.google-analytics.com https://*.googletagmanager.com",
        "upgrade-insecure-requests",
      ].join("; "),
    },
  ];
}
