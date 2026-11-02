import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirectToPath } from "@/lib/relative-redirect";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

const TYPES: EmailOtpType[] = ["signup", "recovery", "email_change", "email", "invite", "magiclink"];

/**
 * Token-hash verification: where the sign-up confirmation and password-reset emails link (supabase/templates).
 * Everything needed is in the link, so it works in whichever browser opens it, including Safari after a request
 * made in the iPhone app; the PKCE code exchange in /auth/callback only works in the browser that made the request.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/onboarding");

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectToPath(next);
  }
  return redirectToPath("/login?error=link_invalid");
}
