import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * A Supabase client for the email-link routes whose cookie writes are held back until the route decides (F-10,
 * security assessment 2026-11-20). An email link signs in whoever opens it. Someone could send a member a link to
 * *their own* account; opened in a browser where the member is signed in, it silently replaced the member's session
 * with the sender's, and what the member logged next went to the sender. The route now verifies the link, compares the
 * account it signs in with the one already signed in here, and only then applies the new session's cookies.
 */
export function linkClient(request: NextRequest) {
  const held: CookieToSet[] = [];
  const client = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        held.push(...toSet);
      },
    },
  });
  return { client, held };
}

/** Apply held session cookies to a response (Secure over HTTPS, as everywhere else). */
export function withCookies(response: NextResponse, cookies: CookieToSet[], request: NextRequest): NextResponse {
  const httpsOnly = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  for (const c of cookies) response.cookies.set(c.name, c.value, { ...c.options, secure: httpsOnly || c.options?.secure });
  return response;
}
