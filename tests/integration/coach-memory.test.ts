import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Coaching memory is enforced by the database: owner-only, Pro (or kept AI terms), memory switched on, 100 at most. */
describe.skipIf(!available)("coaching memory access rules", () => {
  let pro: TestUser;
  let free: TestUser;
  let other: TestUser;
  const note = (u: TestUser, content: string) => u.client.from("coach_memories").insert({ user_id: u.id, category: "schedule", content, source: "member" }).select("id").single();

  beforeAll(async () => {
    [pro, free, other] = await Promise.all([createTestUser("memory-pro"), createTestUser("memory-free"), createTestUser("memory-other")]);
    await grantPlan(pro, "pro");
    await grantPlan(other, "pro");
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(pro), deleteTestUser(free), deleteTestUser(other)]);
  });

  it("is off until the member turns it on, and needs the AI coach", async () => {
    expect((await note(pro, "Trains at 6 am before work.")).error).not.toBeNull();
    for (const u of [pro, free]) {
      const { error } = await u.client.from("profiles").update({ coach_memory_enabled: true, coach_memory_consent_at: new Date().toISOString() }).eq("id", u.id);
      expect(error).toBeNull();
    }
    expect((await note(pro, "Trains at 6 am before work.")).error).toBeNull();
    // A Free member can't add memories even by calling the API directly.
    expect((await note(free, "Trains at 6 am before work.")).error).not.toBeNull();
  });

  it("also works for a Plus subscriber who kept the AI coach from before the plan change", async () => {
    const legacy = await createTestUser("memory-legacy");
    try {
      const subId = `sub_memory_${legacy.id.slice(0, 8)}`;
      const admin = serviceClient();
      await admin.from("subscriptions").insert({ user_id: legacy.id, stripe_subscription_id: subId, plan: "plus", status: "active", current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString() });
      await admin.from("legacy_plan_terms").insert({ stripe_subscription_id: subId, user_id: legacy.id, plan: "plus", ai_monthly_limit: 60, ai_plan_monthly_limit: 0, ai_smart_monthly_limit: 6 });
      await grantPlan(legacy, "plus");
      await legacy.client.from("profiles").update({ coach_memory_enabled: true }).eq("id", legacy.id);
      expect((await note(legacy, "Prefers kettlebell work at home.")).error).toBeNull();
      // Once that subscription ends, kept terms no longer apply.
      await admin.from("subscriptions").update({ status: "canceled" }).eq("stripe_subscription_id", subId);
      expect((await note(legacy, "Wants to try a strongman event.")).error).not.toBeNull();
    } finally {
      await deleteTestUser(legacy);
    }
  });

  it("keeps memories private to their owner", async () => {
    const { data } = await pro.client.from("coach_memories").select("id, content").eq("user_id", pro.id);
    expect(data).toHaveLength(1);
    const id = data![0]!.id as string;
    expect((await other.client.from("coach_memories").select("id").eq("id", id)).data).toEqual([]);
    expect((await other.client.from("coach_memories").update({ content: "hijacked text" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await other.client.from("coach_memories").delete({ count: "exact" }).eq("id", id)).count).toBe(0);
    // Planting a memory in someone else's account is refused.
    expect((await other.client.from("coach_memories").insert({ user_id: pro.id, category: "other", content: "planted note" })).error).not.toBeNull();
  });

  it("lets members edit only the note itself", async () => {
    const { data } = await pro.client.from("coach_memories").select("id").eq("user_id", pro.id).single();
    expect((await pro.client.from("coach_memories").update({ content: "Trains at 6:30 am before work." }).eq("id", data!.id).select("content")).data).toEqual([{ content: "Trains at 6:30 am before work." }]);
    expect((await pro.client.from("coach_memories").update({ source: "approved_change" }).eq("id", data!.id)).error).not.toBeNull();
  });

  it("still lets a downgraded member read and delete their memories, but not add new ones", async () => {
    await serviceClient().from("user_entitlements").delete().eq("user_id", pro.id);
    const { data } = await pro.client.from("coach_memories").select("id").eq("user_id", pro.id);
    expect(data).toHaveLength(1);
    expect((await note(pro, "Wants to run a 10K in April.")).error).not.toBeNull();
    expect((await pro.client.from("coach_memories").delete({ count: "exact" }).eq("id", data![0]!.id)).count).toBe(1);
    await grantPlan(pro, "pro");
  });

  it("caps memories at 100, even when saved at the same moment", async () => {
    await serviceClient()
      .from("coach_memories")
      .insert(Array.from({ length: 97 }, (_, i) => ({ user_id: pro.id, category: "other", content: `Seeded note number ${i}`, source: "member" })));
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => note(pro, `Parallel note ${i}`)));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(results.filter((r) => r.error?.message.includes("coach_memory_limit"))).toHaveLength(3);
    const { count } = await serviceClient().from("coach_memories").select("id", { count: "exact", head: true }).eq("user_id", pro.id);
    expect(count).toBe(100);
  });

  it("can mark a conversation as not to be remembered", async () => {
    const { data: conv } = await pro.client.from("ai_conversations").insert({ user_id: pro.id, title: "Off the record", memory_off: true }).select("id, memory_off").single();
    expect(conv!.memory_off).toBe(true);
    expect((await pro.client.from("ai_conversations").update({ memory_off: false }).eq("id", conv!.id).select("memory_off")).data).toEqual([{ memory_off: false }]);
  });

  it("is removed with the account", async () => {
    const victim = await createTestUser("memory-delete");
    await grantPlan(victim, "pro");
    await victim.client.from("profiles").update({ coach_memory_enabled: true }).eq("id", victim.id);
    expect((await note(victim, "Prefers kettlebells.")).error).toBeNull();
    await deleteTestUser(victim);
    const { count } = await serviceClient().from("coach_memories").select("id", { count: "exact", head: true }).eq("user_id", victim.id);
    expect(count).toBe(0);
  });
});
