// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F-8: every admin page and action calls requireAdmin. An admin whose session is password-only (aal1) is sent to
 * /admin/mfa (enrol or enter a code) and does nothing admin; with a verified second factor (aal2) they pass; anyone
 * who isn't an admin goes Home. The database enforces the same (tests/integration/admin-mfa.test.ts).
 */
const state = { role: "admin" as string | null, aal: "aal1" as string };
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
      getSession: async () => ({ data: { session: null } }),
      getClaims: async () => ({ data: { claims: { sub: "u1", aal: state.aal } }, error: null }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.role ? { id: "u1", role: state.role } : null }) }) }) }),
  }),
}));
class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock("@/server/legal", () => ({ hasCurrentAcceptance: vi.fn(), reacceptRequired: vi.fn() }));

const { requireAdmin } = await import("@/server/auth");
const where = async () => requireAdmin().then(() => "allowed", (e: unknown) => (e instanceof Redirect ? e.to : `error: ${String(e)}`));

beforeEach(() => {
  state.role = "admin";
  state.aal = "aal1";
});

describe("requireAdmin", () => {
  it("sends a password-only admin session to the second step", async () => {
    expect(await where()).toBe("/admin/mfa");
  });
  it("lets an admin verified with an authenticator through", async () => {
    state.aal = "aal2";
    expect(await where()).toBe("allowed");
  });
  it("sends everyone else Home, whatever their session", async () => {
    state.role = "member";
    state.aal = "aal2";
    expect(await where()).toBe("/home");
  });
});
