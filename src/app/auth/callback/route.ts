import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/** PKCE code exchange for email confirmation, password recovery and email change links. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/home");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription)}`, url.origin));
  }
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // Exchange can fail when the link is opened in a different browser. The email is still confirmed.
  return NextResponse.redirect(
    new URL(`/login?notice=${encodeURIComponent("Your link was processed. Please sign in to continue.")}`, url.origin),
  );
}
