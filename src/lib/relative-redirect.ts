import { NextResponse } from "next/server";

/**
 * A redirect to a path on this site, left for the browser to resolve against the address it used. Building the
 * target from `request.url` gives the server's own address instead: under `next start -H 0.0.0.0` that is
 * http://0.0.0.0:3000, behind a proxy an internal host. The browser can't reach it, and it has none of the cookies
 * (the session) just set, so an email confirmation ended on the sign-in page.
 */
export function redirectToPath(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
