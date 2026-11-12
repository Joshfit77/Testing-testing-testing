import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** The AI coach's limits are enforced by the database at the moment of each request, not checked then counted. */
describe.skipIf(!available)("AI usage reservations and coach message integrity", () => {
  let user: TestUser;
  const reserve = (over: Partial<Record<string, unknown>> = {}) =>
    serviceClient().rpc("reserve_ai_usage", {
      p_user_id: user.id,
      p_kind: "chat",
      p_tier: "fast",
      p_chat_limit: 150,
      p_plan_limit: 15,
      p_smart_limit: 15,
      p_per_minute: 100,
      ...over,
    });

  beforeAll(async () => {
    user = await createTestUser("ai-limits");
  });
  afterAll(async () => deleteTestUser(user));

  it("requests sent at the same moment can't overshoot the monthly allowance", async () => {
    // 147 of 150 used earlier this month (but not in the last minute).
    const earlier = new Date(Math.max(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) + 1000, Date.now() - 5 * 60_000)).toISOString();
    await serviceClient().from("ai_usage_events").insert(Array.from({ length: 147 }, () => ({ user_id: user.id, kind: "chat", model_tier: "fast", created_at: earlier })));
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve()));
    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(results.filter((r) => r.error?.message.includes("ai_quota"))).toHaveLength(7);
    const { count } = await serviceClient().from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(150);
    await serviceClient().from("ai_usage_events").delete().eq("user_id", user.id);
  });

  it("enforces the per-minute limit and the larger model's share", async () => {
    for (let i = 0; i < 3; i++) expect((await reserve({ p_per_minute: 3 })).error).toBeNull();
    expect((await reserve({ p_per_minute: 3 })).error?.message).toContain("ai_rate_limited");
    await serviceClient().from("ai_usage_events").delete().eq("user_id", user.id);

    expect((await reserve({ p_tier: "smart", p_smart_limit: 1 })).data).toEqual([expect.objectContaining({ model_tier: "smart" })]);
    // The share is used up: a chat falls back to the fast model, and plan generation is refused.
    expect((await reserve({ p_tier: "smart", p_smart_limit: 1 })).data).toEqual([expect.objectContaining({ model_tier: "fast" })]);
    expect((await reserve({ p_kind: "plan", p_tier: "smart", p_smart_limit: 1 })).error?.message).toContain("ai_quota_plan");
    await serviceClient().from("ai_usage_events").delete().eq("user_id", user.id);
  });

  it("members can't reserve or write usage themselves", async () => {
    const { error } = await user.client.rpc("reserve_ai_usage", { p_user_id: user.id, p_kind: "chat", p_tier: "fast", p_chat_limit: 999, p_plan_limit: 9, p_smart_limit: 9, p_per_minute: 99 });
    expect(error).not.toBeNull();
    expect((await user.client.from("ai_usage_events").insert({ user_id: user.id, kind: "chat" })).error).not.toBeNull();
  });

  it("members can write their own questions but not assistant replies, and can't edit message text", async () => {
    const { data: conv } = await user.client.from("ai_conversations").insert({ user_id: user.id, title: "Test" }).select("id").single();
    const own = await user.client.from("ai_messages").insert({ conversation_id: conv!.id, user_id: user.id, role: "user", content: "Hi" }).select("id").single();
    expect(own.error).toBeNull();
    const forged = await user.client.from("ai_messages").insert({ conversation_id: conv!.id, user_id: user.id, role: "assistant", content: "x".repeat(19_000) });
    expect(forged.error).not.toBeNull();
    const edit = await user.client.from("ai_messages").update({ content: "changed" }).eq("id", own.data!.id).select();
    expect(edit.error).not.toBeNull();
    const status = await user.client.from("ai_messages").update({ proposal_status: null }).eq("id", own.data!.id).select("id");
    expect(status.error).toBeNull();
  });
});
