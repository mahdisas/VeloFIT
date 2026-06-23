import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Supabase Storage public objects (e.g. the gym logo).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    return [
      {
        // The service worker must be served as JS and never cached, so clients
        // always pick up a new sw.js immediately. CSP locks it to same-origin.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // Light global hardening. X-Frame-Options is intentionally omitted — the
        // app is not meant to be framed by third parties, but adding DENY here
        // breaks the local dev preview, and it is not required for PWA support.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
