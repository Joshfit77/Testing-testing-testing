import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { contentSecurityPolicy, generateNonce } from "@/lib/security-headers";
import { isLaunch, markLaunch, updateSession } from "@/lib/supabase/middleware";

const production = process.env.NODE_ENV === "production";
const https = production && (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

export async function middleware(request: NextRequest) {
  // A new nonce for every response. Next.js reads it from the request's CSP header and puts it on its own scripts;
  // the root layout reads x-nonce for its two inline scripts.
  const nonce = generateNonce();
  const csp = contentSecurityPolicy({ supabaseUrl: publicEnv.supabaseUrl, production, https, nonce });
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);
  // (updateSession marks a launch itself; without a database the welcome page is the only destination.)
  const response = isSupabaseConfigured() ? await updateSession(request) : isLaunch(request) ? markLaunch(NextResponse.next({ request }), request) : NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, the service worker, manifest/icons, the public-domain Bible text and its offline reader (which
    // has its own fixed CSP, next.config.ts) and the Stripe webhook (which needs the raw body).
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|bible/bsb/|bible-offline\\.|api/stripe/webhook|api/revenuecat/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
