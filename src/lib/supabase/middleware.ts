import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { OPENING_LAUNCH_COOKIE, OPENING_LAUNCH_COOKIE_MAX_AGE, RETURNING_COOKIE } from "@/lib/opening";

// Every signed-in area. A signed-out visit is sent to /login with `next` (path + query) so signing in
// lands back on the same screen instead of bouncing to /home.
export const PROTECTED_PREFIXES = ["/home", "/train", "/run", "/coach", "/nutrition", "/progress", "/calendar", "/plan", "/faith", "/profile", "/onboarding", "/admin"];
const AUTH_PAGES = ["/login", "/signup"];

/**
 * A launch: the full page load of "/" (the iPhone app's address, a typed address or a bookmark), not an in-app
 * navigation, a prefetch or a form action. Next.js removes its own navigation headers (RSC, Next-Router-*) before
 * middleware runs, so this goes by what the browser says: a page load asks for HTML and, where the browser sends
 * Fetch Metadata (Safari 16.4+, Chrome), is a navigation to a document. A page load the service worker (public/sw.js)
 * passes on keeps the "navigate" mode but loses the "document" destination, so either one counts. The app's own
 * fetches (any type accepted, mode "cors", destination "empty") are neither.
 */
export function isLaunch(request: NextRequest): boolean {
  if (request.method !== "GET" || request.nextUrl.pathname !== "/") return false;
  if (!(request.headers.get("accept") ?? "").includes("text/html")) return false;
  const dest = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  return !dest || dest === "document" || mode === "navigate";
}

/** Marks the response to a launch, so the opening plays over the page the launch ends on (src/lib/opening.ts). */
export function markLaunch(response: NextResponse, request: NextRequest): NextResponse {
  response.cookies.set(OPENING_LAUNCH_COOKIE, "1", {
    path: "/",
    maxAge: OPENING_LAUNCH_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    httpOnly: false, // read and removed by the opening's head script
  });
  return response;
}

/**
 * Refreshes the Supabase session cookie and guards protected routes. On a launch it sends someone who has signed in
 * on this device before, and is signed out now, to sign-in rather than the welcome page, and signed-in people Home
 * (from there to onboarding if it isn't finished, by the (app) layout); a new person gets the welcome page.
 */
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
  const launch = isLaunch(request);
  const secure = request.nextUrl.protocol === "https:";
  if (!user && launch && request.cookies.get(RETURNING_COOKIE)?.value === "1" && !request.nextUrl.searchParams.has("deleted")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return markLaunch(redirect, request);
  }
  // Remembered on this device once someone has signed in here (a hint for the launch above, not a credential).
  if (user && request.cookies.get(RETURNING_COOKIE)?.value !== "1") {
    response.cookies.set(RETURNING_COOKIE, "1", { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax", secure, httpOnly: true });
  }
  // Signed in: the launch goes Home from here (and on to onboarding if it isn't finished). The page would redirect
  // too, but a page's redirect response leaves out the cookies set here, and with them the launch mark.
  if (user && launch) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return markLaunch(redirect, request);
  }
  if (launch) markLaunch(response, request);
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
