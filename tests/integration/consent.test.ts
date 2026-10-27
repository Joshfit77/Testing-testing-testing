import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

describe.skipIf(!available)("consent is enforced by the database", () => {
  let member: TestUser;

  beforeAll(async () => {
    member = await createTestUser("consent");
  });

  afterAll(async () => {
    await deleteTestUser(member);
  });

  const checkin = (u: TestUser) => ({
    user_id: u.id,
    checked_on: "2026-10-01",
    sleep_quality: 3,
    energy: 3,
    soreness: 3,
    stress: 3,
    readiness_score: 60,
  });

  it("refuses recovery check-ins without wellness consent", async () => {
    const { error } = await member.client.from("recovery_checkins").insert(checkin(member));
    expect(error?.message).toMatch(/Consent is required/);
  });

  it("stores recovery check-ins once consent is given", async () => {
    await member.client.from("profiles").update({ wellness_consent_at: new Date().toISOString() }).eq("id", member.id);
    const { error } = await member.client.from("recovery_checkins").insert(checkin(member));
    expect(error).toBeNull();
    await member.client.from("profiles").update({ wellness_consent_at: null }).eq("id", member.id);
    const { error: updErr } = await member.client.from("recovery_checkins").update({ energy: 4 }).eq("user_id", member.id);
    expect(updErr?.message).toMatch(/Consent is required/);
  });

  it("refuses AI coach messages without AI consent", async () => {
    const { data: conv, error: convErr } = await member.client.from("ai_conversations").insert({ user_id: member.id }).select("id").single();
    expect(convErr).toBeNull();
    const message = { conversation_id: conv!.id, user_id: member.id, role: "user", content: "hello" };
    const { error } = await member.client.from("ai_messages").insert(message);
    expect(error?.message).toMatch(/Consent is required/);

    await member.client.from("profiles").update({ ai_consent_at: new Date().toISOString() }).eq("id", member.id);
    const { error: okErr } = await member.client.from("ai_messages").insert(message);
    expect(okErr).toBeNull();
  });

  it("members can't consent on someone else's behalf", async () => {
    const other = await createTestUser("consent-other");
    try {
      const { data } = await member.client.from("profiles").update({ ai_consent_at: new Date().toISOString() }).eq("id", other.id).select("id");
      expect(data).toEqual([]);
      const { data: row } = await serviceClient().from("profiles").select("ai_consent_at").eq("id", other.id).single();
      expect(row?.ai_consent_at).toBeNull();
    } finally {
      await deleteTestUser(other);
    }
  });
});
