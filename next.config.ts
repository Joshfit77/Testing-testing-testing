import path from "node:path";
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
      // The seven Home backgrounds are requested with a version (?v=N, src/lib/home-backgrounds.ts), so they can be
      // kept for a year. That is what lets tomorrow's picture show in the native app without a connection (the
      // native app has no service worker).
      { source: "/home-backgrounds/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The offline Bible reader is a static page the middleware doesn't see, so it carries its own fixed policy.
      { source: "/bible-offline.html", headers: [{ key: "Content-Security-Policy", value: OFFLINE_BIBLE_CSP }] },
    ];
  },
  // The 3D exercise showcase was retired (2026-11-04: exercise demos are 2D only); old links land on the exercise library.
  async redirects() {
    return [{ source: "/train/3d", destination: "/train/exercises", permanent: false }];
  },
  // The hydration fix (scripts/react-hydration-replay-fix.mjs, docs/HYDRATION_418.md) edits React inside
  // node_modules/next, which webpack's build cache treats as unchanging: key the cache to the fix so a cached copy of
  // the unfixed React is never reused. `npm run build` also checks the browser bundle for the fix afterwards.
  webpack(config) {
    if (config.cache && typeof config.cache === "object" && config.cache.type === "filesystem") {
      config.cache.buildDependencies = {
        ...config.cache.buildDependencies,
        reactHydrationReplayFix: [path.join(process.cwd(), "scripts", "react-hydration-replay-fix.mjs")],
      };
    }
    return config;
  },
  // Server code reads the Bible from public/bible/bsb with fs (src/server/bible/text.ts): ship those files with the
  // server functions that use them on hosts that trace dependencies (Vercel and other serverless builds).
  outputFileTracingIncludes: {
    // Biblical AI also reads the original-language layer and the cross references (server-only data, never public).
    "/faith/**": ["./public/bible/bsb/**/*", "./data/original-languages/**/*", "./data/cross-references/**/*"],
    "/api/**": ["./public/bible/bsb/**/*", "./data/original-languages/**/*", "./data/cross-references/**/*"],
    // The verse of the day (Home) and rank verses (badges) show the words of Jesus in red from the same files.
    "/home": ["./public/bible/bsb/**/*"],
    "/progress/**": ["./public/bible/bsb/**/*"],
  },
};

export default nextConfig;
