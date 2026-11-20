import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
/** Who is signed in in the browser opening the link (null: nobody). */
const signedIn = { id: null as string | null };
/** The cookie writes the auth client asks for (the routes decide whether they reach the browser). */
let writeCookies: (c: { name: string; value: string; options?: Record<string, unknown> }[]) => void = () => {};
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: typeof writeCookies } }) => {
    writeCookies = opts.cookies.setAll;
    return { auth: { getUser: async () => ({ data: { user: signedIn.id ? { id: signedIn.id } : null } }), exchangeCodeForSession, verifyOtp } };
  },
}));
/** A link that signs in `userId`: the auth client writes that session's cookie, as Supabase does. */
const signsIn = (userId: string) => async () => {
  writeCookies([{ name: "sb-test-auth-token", value: `session-of-${userId}`, options: { path: "/" } }]);
  return { data: { user: { id: userId }, session: { user: { id: userId } } }, error: null };
};

const { GET: callback } = await import("@/app/auth/callback/route");
const { GET: confirm } = await import("@/app/auth/confirm/route");
const { authLinkMessage } = await import("@/lib/auth-messages");
const { AUTH_LINK_LIMIT } = await import("@/server/auth-link-limit");

const at = (path: string) => new NextRequest(new URL(path, "https://app.narrowgate.test"));
// The routes redirect to a path (lib/relative-redirect): the browser resolves it against the address it used.
const location = (res: Response) => {
  const raw = res.headers.get("location")!;
  expect(raw.startsWith("/") && !raw.startsWith("//"), `a same-site path, not ${raw}`).toBe(true);
  const u = new URL(raw, "https://app.narrowgate.test");
  return u.pathname + u.search;
};

describe("auth link routes", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    signedIn.id = null;
  });

  it("a link for a different account than the one signed in here doesn't replace this browser's session (F-10)", async () => {
    signedIn.id = "member-a";
    verifyOtp.mockImplementation(signsIn("sender-b"));
    const res = await confirm(at("/auth/confirm?token_hash=t&type=email&next=/onboarding"));
    expect(location(res)).toBe("/home?link=other_account");
    expect(res.cookies.get("sb-test-auth-token")).toBeUndefined();
    exchangeCodeForSession.mockImplementation(signsIn("sender-b"));
    const viaCode = await callback(at("/auth/callback?code=c&next=/home"));
    expect(location(viaCode)).toBe("/home?link=other_account");
    expect(viaCode.cookies.get("sb-test-auth-token")).toBeUndefined();
  });

  it("a link for the account already signed in, or opened while signed out, signs in as usual (Secure over HTTPS)", async () => {
    signedIn.id = "member-a";
    verifyOtp.mockImplementation(signsIn("member-a"));
    const own = await confirm(at("/auth/confirm?token_hash=t&type=recovery&next=/reset-password"));
    expect(location(own)).toBe("/reset-password");
    expect(own.cookies.get("sb-test-auth-token")).toMatchObject({ value: "session-of-member-a", secure: true });
    signedIn.id = null;
    verifyOtp.mockImplementation(signsIn("new-member"));
    const fresh = await confirm(at("/auth/confirm?token_hash=t&type=email&next=/onboarding"));
    expect(location(fresh)).toBe("/onboarding");
    expect(fresh.cookies.get("sb-test-auth-token")?.value).toBe("session-of-new-member");
  });

  it("a reset link whose code can't be exchanged (opened in another browser) goes to the reset page, not to sign-in", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "both auth code and code verifier should be non-empty" } });
    expect(location(await callback(at("/auth/callback?next=/reset-password&code=abc")))).toBe("/reset-password");
    // A sign-up confirmation is already done by then, so the member is asked to sign in.
    expect(location(await callback(at("/auth/callback?next=/onboarding&code=abc")))).toBe("/login?notice=link_processed");
  });

  it("a successful exchange continues to the requested same-site page only", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    expect(location(await callback(at("/auth/callback?next=/reset-password&code=abc")))).toBe("/reset-password");
    expect(location(await callback(at("/auth/callback?next=//evil.example&code=abc")))).toBe("/home");
    expect(location(await callback(at("/auth/callback?next=/.//evil.example&code=abc")))).toBe("/home");
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    expect(location(await confirm(at("/auth/confirm?token_hash=pkce_abc&type=email&next=/a/..//evil.example")))).toBe("/onboarding");
  });

  it("never passes the provider's or an attacker's error text on to the sign-in page", async () => {
    const res = await callback(at(`/auth/callback?error=access_denied&error_description=${encodeURIComponent("Your account is locked. Call +1 555 0100")}`));
    expect(location(res)).toBe("/login?error=link_invalid");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("/auth/confirm verifies the token hash and continues; an invalid link goes to sign-in with a fixed message", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    expect(location(await confirm(at("/auth/confirm?token_hash=pkce_abc&type=recovery&next=/reset-password")))).toBe("/reset-password");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "pkce_abc" });
    expect(location(await confirm(at("/auth/confirm?token_hash=pkce_abc&type=email&next=/onboarding")))).toBe("/onboarding");
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    expect(location(await confirm(at("/auth/confirm?token_hash=old&type=recovery")))).toBe("/login?error=link_invalid");
    expect(location(await confirm(at("/auth/confirm?token_hash=x&type=bogus")))).toBe("/login?error=link_invalid");
  });

  it("the sign-in page shows only its own fixed messages", () => {
    expect(authLinkMessage("link_invalid")).toBe("That link is invalid or has expired.");
    expect(authLinkMessage("link_processed")).toMatch(/sign in/);
    for (const crafted of ["Your account is locked. Call +1 555 0100", "constructor", "__proto__", "toString", "", undefined, ["link_invalid"]]) {
      expect(authLinkMessage(crafted)).toBeNull();
    }
  });

  it("too many link openings from one connection are stopped before Supabase is called; other connections are unaffected", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const from = (ip: string, path: string) => new NextRequest(new URL(path, "https://app.narrowgate.test"), { headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < AUTH_LINK_LIMIT.limit; i++) expect(location(await confirm(from("203.0.113.9", `/auth/confirm?token_hash=guess${i}&type=recovery`)))).toBe("/login?error=link_invalid");
    expect(verifyOtp).toHaveBeenCalledTimes(AUTH_LINK_LIMIT.limit);
    expect(location(await confirm(from("203.0.113.9", "/auth/confirm?token_hash=one_more&type=recovery")))).toBe("/login?error=link_busy");
    expect(location(await callback(from("203.0.113.9", "/auth/callback?code=x")))).toBe("/login?error=link_busy");
    expect(verifyOtp).toHaveBeenCalledTimes(AUTH_LINK_LIMIT.limit);
    expect(authLinkMessage("link_busy")).toMatch(/wait a few minutes/);
    // Someone else, elsewhere, is unaffected.
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    expect(location(await confirm(from("198.51.100.20", "/auth/confirm?token_hash=real&type=signup")))).toBe("/onboarding");
  });
});
