import type { NextConfig } from "next";
import { OFFLINE_BIBLE_CSP, securityHeaders } from "./src/lib/security-headers";

const production = process.env.NODE_ENV === "production";
// HTTPS-only headers (HSTS, upgrade-insecure-requests) apply when the site is served over https.
const https = production && (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, production, https }) },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      // The offline Bible reader is a static page the middleware doesn't see, so it carries its own fixed policy.
      { source: "/bible-offline.html", headers: [{ key: "Content-Security-Policy", value: OFFLINE_BIBLE_CSP }] },
    ];
  },
  // The 3D exercise showcase was retired (2026-11-04: exercise demos are 2D only); old links land on the exercise library.
  async redirects() {
    return [{ source: "/train/3d", destination: "/train/exercises", permanent: false }];
  },
  // Server code reads the Bible from public/bible/bsb with fs (src/server/bible/text.ts): ship those files with the
  // server functions that use them on hosts that trace dependencies (Vercel and other serverless builds).
  outputFileTracingIncludes: {
    "/faith/**": ["./public/bible/bsb/**/*"],
    "/api/**": ["./public/bible/bsb/**/*"],
    // The verse of the day (Home) and rank verses (badges) show the words of Jesus in red from the same files.
    "/home": ["./public/bible/bsb/**/*"],
    "/progress/**": ["./public/bible/bsb/**/*"],
  },
};

export default nextConfig;
