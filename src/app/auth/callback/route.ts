import type { NextRequest } from "next/server";
import { redirectToPath } from "@/lib/relative-redirect";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import type { AuthLinkMessage } from "@/lib/auth-messages";

const toLogin = (param: "error" | "notice", code: AuthLinkMessage) => redirectToPath(`/login?${param}=${code}`);

/**
 * PKCE code exchange, for emails that still use Supabase's default links. The email templates in
 * supabase/templates link to /auth/confirm instead, which works in any browser (see that route).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/home");

  // The provider's own error text is not shown: the sign-in page only displays fixed messages.
  if (url.searchParams.get("error_description") || url.searchParams.get("error")) return toLogin("error", "link_invalid");
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectToPath(next);
  }
  // The exchange fails when the link is opened in another browser than the one that asked for it (for example
  // Safari, for a request made in the iPhone app). A password reset can't continue there: the reset page says so
  // and offers a new link. A sign-up confirmation is already done, so the member can just sign in.
  if (next === "/reset-password" || next.startsWith("/reset-password?")) return redirectToPath("/reset-password");
  return toLogin("notice", "link_processed");
}
