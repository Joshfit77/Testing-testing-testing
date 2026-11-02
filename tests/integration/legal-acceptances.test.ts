import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AUTO_RENEWAL_CONSENT, autoRenewalText, signupAcceptances } from "@/lib/legal/versions";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));

const available = await stackAvailable();

/**
 * What a member agreed to at sign-up, and later, is recorded with the version and fingerprint, and can't be altered.
 * Only versions the app has published count (legal_document_versions), and only the server writes the records.
 */
describe.skipIf(!available)("legal acceptance records", () => {
  let member: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("legal-member"), createTestUser("legal-other")]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(member), deleteTestUser(other)]);
  });

  it("records the Terms, Privacy Policy and health & AI acknowledgment with the new account, in the same step", async () => {
    const email = `it-legal-signup-${Date.now()}@example.com`;
    const accepted = signupAcceptances();
    const { data, error } = await anonClient().auth.signUp({
      email,
      password: "Integration-Test-1",
      options: {
        data: {
          display_name: "Signup",
          legal_acceptances: [
            ...accepted,
            { document: "terms", version: "x", sha256: "not-a-hash" },
            { document: "auto_renewal", version: "1", sha256: "a".repeat(64) },
            // Well formed, but not a version the app ever showed: not recorded either.
            { document: "privacy", version: "2099-01-01", sha256: "b".repeat(64) },
          ],
        },
      },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    try {
      const { data: rows } = await serviceClient().from("legal_acceptances").select("document, version, document_sha256, source, accepted_at").eq("user_id", id).order("document");
      // Malformed entries, unpublished versions, and documents that can't be accepted at sign-up, are ignored.
      expect(rows?.map((r) => [r.document, r.version, r.document_sha256, r.source])).toEqual(
        [...accepted].sort((a, b) => a.document.localeCompare(b.document)).map((a) => [a.document, a.version, a.sha256, "signup"]),
      );
      expect(Math.abs(Date.parse(rows![0]!.accepted_at as string) - Date.now())).toBeLessThan(60_000);
    } finally {
      await serviceClient().auth.admin.deleteUser(id);
    }
    expect((await serviceClient().from("legal_acceptances").select("id", { count: "exact", head: true }).eq("user_id", id)).count).toBe(0);
  });

  it("the published versions are listed, the same as the app's (src/lib/legal/versions.ts)", async () => {
    const { publishedLegalVersions, registerLegalVersions } = await import("@/server/legal");
    await registerLegalVersions();
    const { data } = await serviceClient().from("legal_document_versions").select("document, version, document_sha256");
    for (const v of publishedLegalVersions()) expect(data, v.document).toContainEqual(v);
  });

  it("members can't write records themselves; the server's are checked against the published versions", async () => {
    const row = { user_id: member.id, document: "terms", version: "2026-10-26-placeholder", document_sha256: "b".repeat(64), source: "reaccept" };
    for (const forged of [row, { ...row, source: "signup" }, { ...row, user_id: other.id }]) {
      expect((await member.client.from("legal_acceptances").insert(forged)).error).not.toBeNull();
    }
    // Re-acceptance through the server: the app's own versions and fingerprints, the database's time.
    const { currentReacceptRows, recordAcceptances } = await import("@/server/legal");
    await recordAcceptances(member.id, currentReacceptRows(), "reaccept");
    const { data: rows } = await member.client.from("legal_acceptances").select("id, document, version, document_sha256, accepted_at").eq("source", "reaccept");
    expect(rows?.map((r) => r.document).sort()).toEqual(["privacy", "risk_acknowledgment", "terms"]);
    for (const r of rows ?? []) expect(Date.now() - Date.parse(r.accepted_at as string)).toBeLessThan(60_000);

    // Even the server can't record a version that was never published, or details on anything but auto-renewal.
    const svc = serviceClient();
    expect((await svc.from("legal_acceptances").insert(row)).error?.message).toContain("Unknown legal document version");
    const terms = currentReacceptRows()[0]!;
    expect((await svc.from("legal_acceptances").insert({ ...row, document_sha256: terms.sha256, details: "anything" })).error).not.toBeNull();

    // Records can't be edited or deleted by the member, and other members can't see them.
    const id = rows![0]!.id;
    expect((await member.client.from("legal_acceptances").update({ version: "forged" }).eq("id", id).select("id")).data ?? []).toEqual([]);
    expect((await member.client.from("legal_acceptances").delete().eq("id", id).select("id")).data ?? []).toEqual([]);
    expect((await svc.from("legal_acceptances").select("version").eq("id", id).single()).data?.version).toBe(rows![0]!.version);
    expect((await other.client.from("legal_acceptances").select("id").eq("user_id", member.id)).data).toEqual([]);
  });

  it("records auto-renewal consent from checkout with what was agreed to, only from checkout and only with details", async () => {
    const { recordAcceptances } = await import("@/server/legal");
    const details = autoRenewalText("$19.99", "month");
    await recordAcceptances(member.id, [{ document: "auto_renewal", version: AUTO_RENEWAL_CONSENT.version, sha256: AUTO_RENEWAL_CONSENT.sha256, details }], "checkout");
    const { data } = await member.client.from("legal_acceptances").select("details, source").eq("document", "auto_renewal");
    expect(data).toEqual([{ details, source: "checkout" }]);
    const svc = serviceClient();
    const base = { user_id: member.id, document: "auto_renewal", version: AUTO_RENEWAL_CONSENT.version, document_sha256: AUTO_RENEWAL_CONSENT.sha256 };
    expect((await svc.from("legal_acceptances").insert({ ...base, source: "checkout" })).error).not.toBeNull(); // no details
    expect((await svc.from("legal_acceptances").insert({ ...base, source: "reaccept", details })).error).not.toBeNull();
  });
});
