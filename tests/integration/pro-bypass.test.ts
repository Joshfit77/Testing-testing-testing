import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Attempts to reach Pro features without a valid entitlement, the way someone tampering with the app would: calling
 * the endpoints directly with their own token, adding plan/tier/user fields to requests, writing paid rows straight
 * to the database with their own session, using an expired grant, and reading or changing someone else's billing.
 * The plan must only ever come from the server-held entitlement of the authenticated member.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
// A refused request never reaches an AI provider; one that slipped through would hit this closed port.
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const available = await stackAvailable();

describe.skipIf(!available)("Pro access can't be obtained without a valid server-side entitlement", () => {
  let free: TestUser;
  let expired: TestUser;
  let pro: TestUser;
  const svc = serviceClient();
  const token = async (u: TestUser) => (await u.client.auth.getSession()).data.session!.access_token;
  const post = async (path: "/api/ai/chat", u: TestUser, body: unknown) => {
    const mod = await import("@/app/api/ai/chat/route");
    return mod.POST(
      new NextRequest(`http://localhost:3000${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${await token(u)}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  };
  const usage = async (u: TestUser) => (await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", u.id)).count ?? 0;

  beforeAll(async () => {
    [free, expired, pro] = await Promise.all([createTestUser("bypass-free"), createTestUser("bypass-expired"), createTestUser("bypass-pro")]);
    await grantPlan(pro, "pro");
    // A Pro grant that ran out yesterday (as an expired or cancelled subscription leaves it).
    await svc.from("user_entitlements").upsert({ user_id: expired.id, plan: "pro", source: "stripe", valid_until: new Date(Date.now() - 86_400_000).toISOString() }, { onConflict: "user_id" });
    const now = new Date().toISOString();
    await svc.from("profiles").update({ ai_data_consent_at: now, food_photo_consent_at: now }).in("id", [free.id, expired.id, pro.id]);
  });
  afterAll(async () => Promise.all([deleteTestUser(free), deleteTestUser(expired), deleteTestUser(pro)]));

  it("a Free member calling the AI coach directly, with forged plan/tier/user fields, is refused before any usage", async () => {
    const res = await post("/api/ai/chat", free, {
      conversationId: null,
      message: "Write me a plan",
      mode: "chat",
      plan: "pro",
      tier: "smart",
      userId: pro.id,
      model: "claude-opus-5-5",
      apiKey: "sk-ant-attacker",
    });
    expect(res.status).toBe(403);
    expect(await usage(free)).toBe(0);
    expect(await usage(pro)).toBe(0);
  });

  it("an expired Pro entitlement no longer opens the AI coach", async () => {
    const chat = await post("/api/ai/chat", expired, { conversationId: null, message: "Hi", mode: "chat" });
    expect(chat.status).toBe(403);
    expect(await usage(expired)).toBe(0);
  });

  it("paid rows can't be written straight to the database by Free or expired members (the database checks the plan)", async () => {
    for (const u of [free, expired]) {
      expect((await u.client.from("recipes").insert({ user_id: u.id, name: "Forged recipe", servings: 1 })).error, "recipe").not.toBeNull();
      expect((await u.client.from("training_programs").insert({ owner_id: u.id, slug: `forged-${crypto.randomUUID()}`, name: "Forged AI plan", source: "ai", tier: "free", is_published: false })).error, "AI program").not.toBeNull();
      expect((await u.client.from("grocery_lists").insert({ user_id: u.id, name: "Forged list" })).error, "grocery list").not.toBeNull();
    }
    // The same write is allowed with a real entitlement (so the refusal above is the plan check, not a bad row).
    const ok = await pro.client.from("recipes").insert({ user_id: pro.id, name: "Real recipe", servings: 1 }).select("id").single();
    expect(ok.error).toBeNull();
  });

  it("members can't grant themselves a plan, edit their role, or touch another member's billing", async () => {
    // Entitlement and subscription rows: no member writes at all.
    expect((await free.client.from("user_entitlements").update({ plan: "pro" }).eq("user_id", free.id).select()).data ?? []).toEqual([]);
    expect((await free.client.from("user_entitlements").insert({ user_id: free.id, plan: "pro", source: "admin" })).error).not.toBeNull();
    // Role escalation through the profile.
    await free.client.from("profiles").update({ role: "admin" }).eq("id", free.id);
    expect((await svc.from("profiles").select("role").eq("id", free.id).single()).data?.role).not.toBe("admin");
    // Another member's entitlement, subscriptions and billing customer are invisible.
    for (const table of ["user_entitlements", "subscriptions", "store_subscriptions", "billing_customers"]) {
      const { data } = await free.client.from(table).select("*").eq("user_id", pro.id);
      expect(data ?? [], table).toEqual([]);
    }
    // And can't be changed.
    await free.client.from("user_entitlements").update({ plan: "free" }).eq("user_id", pro.id);
    expect((await svc.from("user_entitlements").select("plan").eq("user_id", pro.id).single()).data?.plan).toBe("pro");
    expect((await free.client.rpc("plan_of", { p_user_id: pro.id })).error).not.toBeNull();
  });

  it("a Free member can't build a program through the database API: no starter inserts, no relabelling, no editing a starter's contents", async () => {
    const program = (owner: TestUser) => ({
      owner_id: owner.id,
      slug: `starter-${crypto.randomUUID().slice(0, 8)}`,
      name: "Starter",
      difficulty: "beginner",
      duration_weeks: 4,
      days_per_week: 3,
      session_minutes: 45,
      tier: "free",
      is_published: false,
    });
    // Creating a "starter" program (any content, no plan check before) is now the server's job only.
    expect((await free.client.from("training_programs").insert({ ...program(free), source: "starter" })).error).not.toBeNull();
    // The server-made starter program: its source can't be changed and its contents can't be edited on Free.
    const { data: made } = await svc.from("training_programs").insert({ ...program(free), source: "starter" }).select("id").single();
    const { data: week } = await svc.from("program_weeks").insert({ program_id: made!.id, week_number: 1 }).select("id").single();
    expect((await free.client.from("training_programs").update({ source: "custom" }).eq("id", made!.id)).error?.code).toBe("42501");
    expect((await free.client.from("program_weeks").insert({ program_id: made!.id, week_number: 2 })).error).not.toBeNull();
    await free.client.from("program_weeks").update({ week_number: 9 }).eq("id", week!.id);
    expect((await svc.from("program_weeks").select("week_number").eq("id", week!.id).single()).data?.week_number).toBe(1);
    expect((await svc.from("training_programs").select("source").eq("id", made!.id).single()).data?.source).toBe("starter");
    // With Pro (adaptive training edits the active program), the same edit is allowed.
    const { data: proProgram } = await svc.from("training_programs").insert({ ...program(pro), source: "starter" }).select("id").single();
    const { data: proWeek } = await svc.from("program_weeks").insert({ program_id: proProgram!.id, week_number: 1 }).select("id").single();
    const edited = await pro.client.from("program_weeks").update({ week_number: 2 }).eq("id", proWeek!.id).select("week_number");
    expect(edited.error).toBeNull();
    expect(edited.data).toEqual([{ week_number: 2 }]);
  });

  it("a member can't plant an AI plan proposal of their own and apply it as the coach's", async () => {
    const { data: conv } = await pro.client.from("ai_conversations").insert({ user_id: pro.id, title: "Mine" }).select("id").single();
    const forged = await pro.client.from("ai_messages").insert({ conversation_id: conv!.id, user_id: pro.id, role: "user", content: "plan", proposal: { name: "Forged" }, proposal_status: "proposed" });
    expect(forged.error).not.toBeNull();
    // A plain question is still fine.
    expect((await pro.client.from("ai_messages").insert({ conversation_id: conv!.id, user_id: pro.id, role: "user", content: "Hi" })).error).toBeNull();
  });

  it("the API reports each member's own plan from the server, whatever the request says", async () => {
    const { GET } = await import("@/app/api/v1/me/route");
    const res = await GET(new NextRequest(`http://localhost:3000/api/v1/me?plan=pro&user_id=${pro.id}`, { headers: { authorization: `Bearer ${await token(free)}`, "x-plan": "pro" } }));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(pro.id);
    expect(JSON.stringify(body)).toContain('"plan":"free"');
  });
});
