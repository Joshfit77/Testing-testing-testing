import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirectToPath } from "@/lib/relative-redirect";
import { safeNextPath } from "@/lib/safe-redirect";
import { authLinkLimited } from "@/server/auth-link-limit";
import { linkClient, withCookies } from "@/server/auth-link-session";

// Only the link types our own emails use (supabase/templates): fewer ways to slip someone a session-swapping link.
const TYPES: EmailOtpType[] = ["signup", "recovery", "email"];

/**
 * Token-hash verification: where the sign-up confirmation and password-reset emails link (supabase/templates).
 * Everything needed is in the link, so it works in whichever browser opens it, including Safari after a request
 * made in the iPhone app; the PKCE code exchange in /auth/callback only works in the browser that made the request.
 */
export async function GET(request: NextRequest) {
  if (await authLinkLimited(request)) return redirectToPath("/login?error=link_busy");
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/onboarding");

  if (tokenHash && type && TYPES.includes(type)) {
    const { client, held } = linkClient(request);
    // Who is signed in here already (refreshing their session if it was due: those cookies are kept either way).
    const before = (await client.auth.getUser()).data.user?.id ?? null;
    const kept = held.length;
    const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const after = data.user?.id ?? data.session?.user.id ?? null;
      // A link for a different account than the one signed in here: this browser stays signed in as before (F-10).
      if (before && after && before !== after) return withCookies(redirectToPath("/home?link=other_account"), held.slice(0, kept), request);
      return withCookies(redirectToPath(next), held, request);
    }
  }
  return redirectToPath("/login?error=link_invalid");
}
