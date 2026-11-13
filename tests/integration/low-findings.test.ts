import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { anonClient, createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The remaining Low findings of the 2026-11-01 review (migration 20261102000048, docs/security/PRELAUNCH_SECURITY_REPORT.md):
 * F14 enrolments can't be repointed at a program the member couldn't enrol in; F15 a row naming someone else no
 * longer gets that member's plan, consent or limit back in the error; F17 links point only at the member's own rows
 * (or the public catalog), and the program lookups don't reveal private programs; F18 a retried AI request gets the
 * saved reply, never a second answer or charge.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
// Nothing may reach a real AI provider: a request that gets that far fails on this closed port.
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const available = await stackAvailable();
const RLS = "42501";

describe.skipIf(!available)("Low findings: enrolments, error messages, links, program lookups and AI retries", () => {
  let a: TestUser; // the member whose rows the other one tries to reach
  let b: TestUser;
  let pro: TestUser;
  const svc = serviceClient();
  let freeProgram: string;
  let paidProgram: string;
  let privateProgram: string;
  let privateDay: string;
  let publishedDay: string;
  let aEnrolment: string;
  let aSession: string;
  let aFood: string;
  let catalogFood: string;
  let squat: string;

  beforeAll(async () => {
    [a, b, pro] = await Promise.all([createTestUser("low-a"), createTestUser("low-b"), createTestUser("low-pro")]);
    await grantPlan(pro, "pro");
    const { data: programs } = await svc.from("training_programs").select("id, tier").eq("is_published", true);
    // Every catalog program is Pro for new enrolments; Free members keep programs they joined earlier.
    freeProgram = programs![0]!.id; // the one A and B were already enrolled in
    paidProgram = programs!.find((p) => p.id !== freeProgram)!.id;
    const { data: priv } = await svc
      .from("training_programs")
      .insert({ owner_id: a.id, slug: `low-${crypto.randomUUID().slice(0, 8)}`, name: "A's own", source: "starter", tier: "free", is_published: false, difficulty: "beginner", duration_weeks: 4, days_per_week: 3, session_minutes: 45 })
      .select("id")
      .single();
    privateProgram = priv!.id;
    const { data: week } = await svc.from("program_weeks").insert({ program_id: privateProgram, week_number: 1 }).select("id").single();
    const { data: day } = await svc.from("program_days").insert({ week_id: week!.id, day_number: 1, name: "Day 1" }).select("id").single();
    privateDay = day!.id;
    const { data: pubDay } = await svc.from("program_days").select("id, program_weeks!inner(program_id)").eq("program_weeks.program_id", freeProgram).limit(1).single();
    publishedDay = pubDay!.id;
    aEnrolment = (await svc.from("user_programs").insert({ user_id: a.id, program_id: freeProgram, status: "active" }).select("id").single()).data!.id;
    aSession = (await svc.from("workout_sessions").insert({ user_id: a.id, client_id: crypto.randomUUID(), name: "A's session" }).select("id").single()).data!.id;
    aFood = (await svc.from("foods").insert({ owner_id: a.id, name: "A's soup", serving_size: 1, serving_unit: "bowl", calories: 300, source: "custom" }).select("id").single()).data!.id;
    catalogFood = (await svc.from("foods").select("id").is("owner_id", null).limit(1).single()).data!.id;
    squat = (await exerciseIds(["back-squat"]))["back-squat"]!;
    const now = new Date().toISOString();
    await svc.from("profiles").update({ ai_data_consent_at: now }).eq("id", pro.id);
  });
  afterAll(async () => {
    await svc.from("training_programs").delete().eq("id", privateProgram);
    await Promise.all([deleteTestUser(a), deleteTestUser(b), deleteTestUser(pro)]);
  });

  it("F14: an enrolment can't be repointed at a paid program or someone's private program; other changes still work", async () => {
    const { data: mine, error } = await svc.from("user_programs").insert({ user_id: b.id, program_id: freeProgram, status: "active" }).select("id").single();
    expect(error).toBeNull();
    // A Free member can't start a catalog program themselves.
    expect((await b.client.from("user_programs").insert({ user_id: b.id, program_id: paidProgram, status: "paused" })).error).not.toBeNull();
    for (const target of [paidProgram, privateProgram]) {
      const res = await b.client.from("user_programs").update({ program_id: target }).eq("id", mine!.id);
      expect(res.error?.code).toBe(RLS);
    }
    expect((await svc.from("user_programs").select("program_id").eq("id", mine!.id).single()).data?.program_id).toBe(freeProgram);
    expect((await b.client.from("user_programs").update({ status: "paused", current_week: 2 }).eq("id", mine!.id)).error).toBeNull();
  });

  it("F15: a row naming another member is refused by RLS, without that member's plan, consent or limits in the error", async () => {
    await svc.from("workout_templates").insert(Array.from({ length: 5 }, (_, i) => ({ user_id: a.id, name: `A ${i}` })));
    const attempts = [
      b.client.from("workout_templates").insert({ user_id: a.id, name: "probe" }),
      b.client.from("activities").insert({ user_id: a.id, kind: "run", source: "gps", started_at: new Date().toISOString(), elapsed_s: 60, moving_s: 60, distance_m: 100 }),
      b.client.from("onboarding_answers").insert({ user_id: a.id, primary_goal: "build_strength", experience: "new", days_per_week: 3, session_minutes: 45, limitations: "knee" }),
      b.client.from("running_goals").insert({ user_id: a.id, kind: "weekly_distance", distance_m: 5000 }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.error?.code).toBe(RLS);
      expect(res.error?.message).toMatch(/row-level security/);
      expect(res.error?.message).not.toMatch(/plan|Pro|Consent|limit/i);
    }
    // The member's own rows are still checked as before.
    const own = await a.client.from("workout_templates").insert({ user_id: a.id, name: "sixth" });
    expect(own.error?.message).toContain("Free plan limit");
    const gps = await a.client.from("activities").insert({ user_id: a.id, kind: "run", source: "gps", started_at: new Date().toISOString(), elapsed_s: 60, moving_s: 60, distance_m: 100 });
    expect(gps.error?.message).toContain("Live GPS recording is included with Pro");
  });

  it("F17: links to another member's enrolment, session or food are refused like a missing row; own and catalog links work", async () => {
    const session = (extra: Record<string, unknown>) => b.client.from("workout_sessions").insert({ user_id: b.id, client_id: crypto.randomUUID(), name: "B", ...extra }).select("id").single();
    const foreign = await session({ user_program_id: aEnrolment });
    const missing = await session({ user_program_id: crypto.randomUUID() });
    expect(foreign.error?.code).toBe("23503");
    expect(foreign.error?.message).toBe(missing.error?.message);
    expect((await session({ program_day_id: privateDay })).error?.code).toBe("23503");

    const pr = await b.client.from("personal_records").insert({ user_id: b.id, exercise_id: squat, record_type: "max_weight", value: 100, session_id: aSession });
    expect(pr.error?.code).toBe("23503");
    const run = await b.client.from("activities").insert({ user_id: b.id, kind: "run", source: "manual", started_at: new Date().toISOString(), elapsed_s: 60, moving_s: 60, workout_session_id: aSession });
    expect(run.error?.code).toBe("23503");

    const { data: meal } = await b.client.from("meals").insert({ user_id: b.id, eaten_on: new Date().toISOString().slice(0, 10), meal_type: "lunch" }).select("id").single();
    const item = (food_id: string) => b.client.from("meal_items").insert({ meal_id: meal!.id, user_id: b.id, food_id, name: "Soup", servings: 1, calories: 300 });
    expect((await item(aFood)).error?.code).toBe("23503");
    expect((await item(catalogFood)).error).toBeNull();

    // The member's own links, and the public catalog, still work.
    const { data: mine } = await b.client.from("user_programs").select("id").eq("user_id", b.id).limit(1).single();
    const own = await session({ user_program_id: mine!.id, program_day_id: publishedDay });
    expect(own.error).toBeNull();
    expect((await b.client.from("personal_records").insert({ user_id: b.id, exercise_id: squat, record_type: "max_weight", value: 100, session_id: own.data!.id })).error).toBeNull();
  });

  it("F17: the program lookups answer for published programs and the caller's own, not for someone's private program", async () => {
    const anon = anonClient();
    expect((await anon.rpc("program_of_day", { p_day_id: privateDay })).data).toBeNull();
    expect((await b.client.rpc("program_of_day", { p_day_id: privateDay })).data).toBeNull();
    expect((await a.client.rpc("program_of_day", { p_day_id: privateDay })).data).toBe(privateProgram);
    expect((await anon.rpc("program_of_day", { p_day_id: publishedDay })).data).toBe(freeProgram);
  });

  describe("F18: AI requests with a request id", () => {
    const token = async (u: TestUser) => (await u.client.auth.getSession()).data.session!.access_token;
    const chat = async (u: TestUser, body: Record<string, unknown>) => {
      const { POST } = await import("@/app/api/ai/chat/route");
      return POST(new NextRequest("http://localhost:3000/api/ai/chat", { method: "POST", headers: { authorization: `Bearer ${await token(u)}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
    };
    const usage = async () => (await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", pro.id)).count ?? 0;
    let conversation: string;
    const answered = crypto.randomUUID();

    beforeAll(async () => {
      conversation = (await svc.from("ai_conversations").insert({ user_id: pro.id, title: "Earlier" }).select("id").single()).data!.id;
      // A request whose reply was saved but never reached the phone.
      await svc.from("ai_messages").insert([
        { conversation_id: conversation, user_id: pro.id, role: "user", content: "How many sets?", request_id: answered },
        { conversation_id: conversation, user_id: pro.id, role: "assistant", content: "Three hard sets.", request_id: answered },
      ]);
    });

    it("a retry of an answered request gets the saved reply, with no new answer and no charge", async () => {
      const before = await usage();
      const res = await chat(pro, { conversationId: null, message: "How many sets?", mode: "chat", requestId: answered });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.conversationId).toBe(conversation);
      expect(body.assistantMessage.content).toBe("Three hard sets.");
      expect(await usage()).toBe(before);
      expect((await svc.from("ai_messages").select("id", { count: "exact", head: true }).eq("request_id", answered)).count).toBe(2);
    });

    it("a retry while the first is still being answered is told to wait (409), and nothing is added", async () => {
      const pending = crypto.randomUUID();
      await svc.from("ai_messages").insert({ conversation_id: conversation, user_id: pro.id, role: "user", content: "Still thinking?", request_id: pending });
      const before = await usage();
      const res = await chat(pro, { conversationId: conversation, message: "Still thinking?", mode: "chat", requestId: pending });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe("in_progress");
      expect(await usage()).toBe(before);
      expect((await svc.from("ai_messages").select("id", { count: "exact", head: true }).eq("request_id", pending)).count).toBe(1);
    });

    it("an abandoned request (no reply after several minutes) is answered afresh; a failed answer charges nothing", async () => {
      const stale = crypto.randomUUID();
      await svc.from("ai_messages").insert({ conversation_id: conversation, user_id: pro.id, role: "user", content: "Lost?", request_id: stale, created_at: new Date(Date.now() - 10 * 60_000).toISOString() });
      const before = await usage();
      const res = await chat(pro, { conversationId: conversation, message: "Lost?", mode: "chat", requestId: stale });
      // Answered afresh: it reached the (closed) provider, which failed, so the reservation was given back.
      expect(res.status).toBe(502);
      expect(await usage()).toBe(before);
      expect((await svc.from("ai_messages").select("id", { count: "exact", head: true }).eq("request_id", stale)).count).toBe(0);
    });

    it("a member over the monthly allowance still gets the reply already saved for their request", async () => {
      const d = new Date();
      const earlier = new Date(Math.max(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 1000, d.getTime() - 5 * 60_000)).toISOString();
      await svc.from("ai_usage_events").insert(Array.from({ length: 150 }, () => ({ user_id: pro.id, kind: "chat", model_tier: "fast", created_at: earlier })));
      const res = await chat(pro, { conversationId: null, message: "How many sets?", mode: "chat", requestId: answered });
      expect(res.status).toBe(200);
      expect((await res.json()).assistantMessage.content).toBe("Three hard sets.");
      // A new request is refused as usual.
      expect((await chat(pro, { conversationId: null, message: "New question", mode: "chat", requestId: crypto.randomUUID() })).status).toBe(429);
    });

    it("another member's request id finds nothing of theirs", async () => {
      const res = await chat(b, { conversationId: null, message: "How many sets?", mode: "chat", requestId: answered });
      expect(res.status).toBe(403); // b is on Free: refused as any request would be, with nothing of pro's returned
      expect(JSON.stringify(await res.json())).not.toContain("Three hard sets");
    });
  });
});
