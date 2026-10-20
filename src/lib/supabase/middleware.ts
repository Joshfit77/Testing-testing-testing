import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";

// Every signed-in area. A signed-out visit is sent to /login with `next` (path + query) so signing in
// lands back on the same screen instead of bouncing to /home.
export const PROTECTED_PREFIXES = ["/home", "/train", "/run", "/coach", "/nutrition", "/progress", "/calendar", "/plan", "/faith", "/profile", "/onboarding", "/admin"];
const AUTH_PAGES = ["/login", "/signup"];

/** Refreshes the Supabase session cookie and guards protected routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth rather than trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (user && AUTH_PAGES.includes(path)) {
    // Already signed in: go where the login was meant to lead (e.g. an old tab's /login?next=/run).
    const target = safeNextPath(request.nextUrl.searchParams.get("next"));
    const url = request.nextUrl.clone();
    const [pathname, query = ""] = target.split("?");
    url.pathname = pathname!;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }
  return response;
}
