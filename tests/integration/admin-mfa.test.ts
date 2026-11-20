import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, totpCode, type TestUser } from "./helpers";

/**
 * F-8 (security assessment 2026-11-20): admin rights only from a session verified with a second factor. Against the
 * real local auth server (TOTP enabled as in supabase/config.toml) and database (is_admin, migration 085):
 *  - an admin signed in with the password alone is an ordinary member: no admin writes, no audit log;
 *  - after enrolling an authenticator and entering a valid code (aal2), admin work is allowed;
 *  - a wrong code, or an enrolment never confirmed, gives nothing;
 *  - a member who sets up an authenticator does not become an admin;
 *  - recovery: when the project owner removes a lost authenticator, the admin signs in with the password and enrols a
 *    new one, and is never locked out.
 */
const available = await stackAvailable();

describe.skipIf(!available)("admin rights need a second factor (F-8)", () => {
  const svc = serviceClient();
  let admin: TestUser;
  let member: TestUser;
  const flag = `mfa_test_${crypto.randomUUID().slice(0, 8)}`;
  /** An admin-only write: create a feature flag (catalog table, admin policy). */
  const tryAdminWrite = async (who: TestUser, key = flag) => who.client.from("feature_flags").insert({ key, enabled: false, description: "admin MFA test" }).select("key");
  const aal = async (who: TestUser) => (await who.client.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel;

  beforeAll(async () => {
    [admin, member] = await Promise.all([createTestUser("mfa-admin"), createTestUser("mfa-member")]);
    const { error } = await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (error) throw error;
  });
  afterAll(async () => {
    await svc.from("feature_flags").delete().like("key", "mfa_test_%");
    await Promise.all([deleteTestUser(admin), deleteTestUser(member)]);
  });

  it("with the password alone an admin is an ordinary member", async () => {
    expect(await aal(admin)).toBe("aal1");
    const write = await tryAdminWrite(admin);
    expect(write.error?.code).toBe("42501");
    expect((await admin.client.from("admin_audit_logs").select("id").limit(1)).data ?? []).toEqual([]);
  });

  it("an enrolment never confirmed and a wrong code give nothing", async () => {
    const { data, error } = await admin.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "phone" });
    expect(error).toBeNull();
    expect(await aal(admin)).toBe("aal1");
    expect((await tryAdminWrite(admin)).error?.code).toBe("42501");
    const wrong = totpCode(data!.totp.secret) === "000000" ? "111111" : "000000";
    const bad = await admin.client.auth.mfa.challengeAndVerify({ factorId: data!.id, code: wrong });
    expect(bad.error).not.toBeNull();
    expect(await aal(admin)).toBe("aal1");
    await admin.client.auth.mfa.unenroll({ factorId: data!.id });
  });

  it("after a valid authenticator code (aal2) admin work is allowed", async () => {
    const { data } = await admin.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "phone 2" });
    const ok = await admin.client.auth.mfa.challengeAndVerify({ factorId: data!.id, code: totpCode(data!.totp.secret) });
    expect(ok.error).toBeNull();
    expect(await aal(admin)).toBe("aal2");
    const write = await tryAdminWrite(admin);
    expect(write.error).toBeNull();
    expect(write.data).toEqual([{ key: flag }]);
  });

  it("a member with an authenticator is still not an admin", async () => {
    const { data } = await member.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "member phone" });
    await member.client.auth.mfa.challengeAndVerify({ factorId: data!.id, code: totpCode(data!.totp.secret) });
    expect(await aal(member)).toBe("aal2");
    expect((await tryAdminWrite(member, `${flag}_m`)).error?.code).toBe("42501");
  });

  it("recovery: when the project owner removes a lost authenticator, the admin signs in and enrols a new one", async () => {
    const { data: factors } = await admin.client.auth.mfa.listFactors();
    const lost = factors!.totp.find((f) => f.status === "verified")!;
    // The owner's step (Supabase dashboard, or the service role): remove the lost factor.
    const { error: delErr } = await svc.auth.admin.mfa.deleteFactor({ id: lost.id, userId: admin.id });
    expect(delErr).toBeNull();

    // Signing in with the password works (no lock-out); admin work waits for a new authenticator.
    const fresh = anonClient();
    const { error: signInErr } = await fresh.auth.signInWithPassword({ email: admin.email, password: "Integration-Test-1" });
    expect(signInErr).toBeNull();
    const again = { ...admin, client: fresh };
    expect(await aal(again)).toBe("aal1");
    expect((await tryAdminWrite(again, `${flag}_r`)).error?.code).toBe("42501");
    const { data } = await fresh.auth.mfa.enroll({ factorType: "totp", friendlyName: "new phone" });
    expect((await fresh.auth.mfa.challengeAndVerify({ factorId: data!.id, code: totpCode(data!.totp.secret) })).error).toBeNull();
    expect((await tryAdminWrite(again, `${flag}_r`)).error).toBeNull();
  });
});
