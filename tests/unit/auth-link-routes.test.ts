import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }) }));

const { GET: callback } = await import("@/app/auth/callback/route");
const { GET: confirm } = await import("@/app/auth/confirm/route");
const { authLinkMessage } = await import("@/lib/auth-messages");

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
  });

  it("a reset link whose code can't be exchanged (opened in another browser) goes to the reset page, not to sign-in", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "both auth code and code verifier should be non-empty" } });
    expect(location(await callback(at("/auth/callback?next=/reset-password&code=abc")))).toBe("/reset-password");
    // A sign-up confirmation is already done by then, so the member is asked to sign in.
    expect(location(await callback(at("/auth/callback?next=/onboarding&code=abc")))).toBe("/login?notice=link_processed");
  });

  it("a successful exchange continues to the requested same-site page only", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(location(await callback(at("/auth/callback?next=/reset-password&code=abc")))).toBe("/reset-password");
    expect(location(await callback(at("/auth/callback?next=//evil.example&code=abc")))).toBe("/home");
    expect(location(await callback(at("/auth/callback?next=/.//evil.example&code=abc")))).toBe("/home");
    verifyOtp.mockResolvedValue({ error: null });
    expect(location(await confirm(at("/auth/confirm?token_hash=pkce_abc&type=email&next=/a/..//evil.example")))).toBe("/onboarding");
  });

  it("never passes the provider's or an attacker's error text on to the sign-in page", async () => {
    const res = await callback(at(`/auth/callback?error=access_denied&error_description=${encodeURIComponent("Your account is locked. Call +1 555 0100")}`));
    expect(location(res)).toBe("/login?error=link_invalid");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("/auth/confirm verifies the token hash and continues; an invalid link goes to sign-in with a fixed message", async () => {
    verifyOtp.mockResolvedValue({ error: null });
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
});
