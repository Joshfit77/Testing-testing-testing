import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signupAcceptances } from "@/lib/legal/versions";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** What a member agreed to at sign-up, and later, is recorded with the version and fingerprint, and can't be altered. */
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
      options: { data: { display_name: "Signup", legal_acceptances: [...accepted, { document: "terms", version: "x", sha256: "not-a-hash" }, { document: "auto_renewal", version: "1", sha256: "a".repeat(64) }] } },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    try {
      const { data: rows } = await serviceClient().from("legal_acceptances").select("document, version, document_sha256, source, accepted_at").eq("user_id", id).order("document");
      // Malformed entries, and documents that can't be accepted at sign-up, are ignored.
      expect(rows?.map((r) => [r.document, r.version, r.document_sha256, r.source])).toEqual(
        [...accepted].sort((a, b) => a.document.localeCompare(b.document)).map((a) => [a.document, a.version, a.sha256, "signup"]),
      );
      expect(Math.abs(Date.parse(rows![0]!.accepted_at as string) - Date.now())).toBeLessThan(60_000);
    } finally {
      await serviceClient().auth.admin.deleteUser(id);
    }
    expect((await serviceClient().from("legal_acceptances").select("id", { count: "exact", head: true }).eq("user_id", id)).count).toBe(0);
  });

  it("members add and read only their own records, can't backdate, edit or delete them, and can't forge a sign-up record", async () => {
    const row = { user_id: member.id, document: "terms", version: "2026-10-26-placeholder", document_sha256: "b".repeat(64), source: "reaccept", accepted_at: "2020-01-01T00:00:00Z" };
    const { data, error } = await member.client.from("legal_acceptances").insert(row).select("id, accepted_at").single();
    expect(error).toBeNull();
    expect(Date.parse(data!.accepted_at as string)).toBeGreaterThan(Date.parse("2026-01-01"));
    expect((await member.client.from("legal_acceptances").insert({ ...row, source: "signup" })).error).not.toBeNull();
    expect((await member.client.from("legal_acceptances").insert({ ...row, user_id: other.id })).error).not.toBeNull();
    expect((await member.client.from("legal_acceptances").insert({ ...row, document_sha256: "short" })).error).not.toBeNull();

    const edit = await member.client.from("legal_acceptances").update({ version: "forged" }).eq("id", data!.id).select("id");
    expect(edit.data ?? []).toEqual([]);
    const del = await member.client.from("legal_acceptances").delete().eq("id", data!.id).select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await serviceClient().from("legal_acceptances").select("version").eq("id", data!.id).single()).data?.version).toBe("2026-10-26-placeholder");

    expect((await other.client.from("legal_acceptances").select("id").eq("user_id", member.id)).data).toEqual([]);
  });

  it("records auto-renewal consent from checkout with what was agreed to", async () => {
    const { error } = await member.client.from("legal_acceptances").insert({
      user_id: member.id,
      document: "auto_renewal",
      version: "2026-10-26",
      document_sha256: "c".repeat(64),
      source: "checkout",
      details: "I agree that Pro All Access renews automatically at $19.99 per month until I cancel, and that I can cancel any time in Manage billing.",
    });
    expect(error).toBeNull();
  });
});
