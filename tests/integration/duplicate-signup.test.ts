import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));

/**
 * A second sign-up with an e-mail that already has an account (e-mail confirmations on, as in production): no second
 * account is created, the existing account and its password are untouched, and the form gets the same "check your
 * inbox" answer as a fresh sign-up, so it never says who is registered. Before this, the local stack's
 * `user_already_exists` error surfaced as "We couldn't create your account. Please try again." and a logged server
 * error, which told the member to keep retrying something that can never work.
 */
const available = await stackAvailable();
describe.skipIf(!available)("duplicate sign-up", () => {
  let existing: TestUser;
  beforeAll(async () => {
    existing = await createTestUser("dup");
  });
  afterAll(async () => {
    await deleteTestUser(existing);
  });

  it("gives the generic 'check your inbox' answer and changes nothing", async () => {
    const { signUpAction } = await import("@/server/actions/auth");
    const admin = serviceClient();
    const before = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(before.data.users.filter((u) => u.email === existing.email).length).toBe(1);

    const form = new FormData();
    form.set("email", existing.email);
    form.set("password", "Another-Password-2026");
    form.set("displayName", "Impostor");
    form.set("ageConfirmed", "on");
    form.set("termsAccepted", "on");
    form.set("riskAcknowledged", "on");
    const result = await signUpAction({ ok: false }, form);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.message).toContain("Check your inbox");

    const after = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(after.data.users.filter((u) => u.email === existing.email).length).toBe(1);
    expect(after.data.users.length).toBe(before.data.users.length);

    // The original account still signs in with its own password; the second attempt's password does not work.
    const own = await anonClient().auth.signInWithPassword({ email: existing.email, password: "Integration-Test-1" });
    expect(own.error).toBeNull();
    const impostor = await anonClient().auth.signInWithPassword({ email: existing.email, password: "Another-Password-2026" });
    expect(impostor.error).not.toBeNull();
    const { data: profile } = await admin.from("profiles").select("display_name").eq("id", existing.id).single();
    expect(profile?.display_name).toBe("dup");
  });
});
