import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

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
    ];
  },
};

export default nextConfig;
