import type { NextRequest } from "next/server";
import { redirectToPath } from "@/lib/relative-redirect";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/** PKCE code exchange for email confirmation, password recovery and email change links. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/home");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return redirectToPath(`/login?error=${encodeURIComponent(errorDescription)}`);
  }
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectToPath(next);
  }
  // Exchange can fail when the link is opened in a different browser. The email is still confirmed.
  return redirectToPath(`/login?notice=${encodeURIComponent("Your link was processed. Please sign in to continue.")}`);
}
