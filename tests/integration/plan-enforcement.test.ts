import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Paid features can't be used by writing to the database directly. The anon key is public, so a Free member can
 * call the REST API with their own session and skip the server actions; row level security has to check the plan
 * too. Each check runs as the member themselves (RLS applies), then again after an upgrade.
 */
describe.skipIf(!available)("plan enforcement in the database (not just the server actions)", () => {
  let free: TestUser;
  let paidProgram: { id: string; tier: string };
  let paidDayId: string;

  const setPlan = async (u: TestUser, plan: "free" | "plus" | "pro") => {
    const { error } = await serviceClient().from("user_entitlements").upsert({ user_id: u.id, plan, source: plan === "free" ? "default" : "admin" }, { onConflict: "user_id" });
    expect(error).toBeNull();
  };

  beforeAll(async () => {
    free = await createTestUser("rls-plan");
    const { data } = await serviceClient().from("training_programs").select("id, tier").eq("is_published", true).eq("tier", "plus").limit(1).single();
    paidProgram = data as { id: string; tier: string };
    const { data: week } = await serviceClient().from("program_weeks").select("id").eq("program_id", paidProgram.id).order("week_number").limit(1).single();
    const { data: day } = await serviceClient().from("program_days").select("id").eq("week_id", week!.id).order("day_number").limit(1).single();
    paidDayId = day!.id as string;
  });
  afterAll(async () => deleteTestUser(free));

  it("Free: can't create recipes, meal plans, grocery lists or custom/AI programs", async () => {
    const c = free.client;
    expect((await c.from("recipes").insert({ user_id: free.id, name: "Direct insert" }).select()).error).not.toBeNull();
    expect(
      (await c.from("meal_plans").insert({ user_id: free.id, start_date: "2026-11-02", days: 7, targets: {}, settings: {} }).select()).error,
    ).not.toBeNull();
    expect((await c.from("grocery_lists").insert({ user_id: free.id }).select()).error).not.toBeNull();
    for (const source of ["custom", "ai"]) {
      const res = await c.from("training_programs").insert({ owner_id: free.id, name: `Direct ${source}`, slug: `direct-${source}-${free.id}`, source, is_published: false, tier: "free", difficulty: "beginner", session_minutes: 45, days_per_week: 3, duration_weeks: 4 }).select();
      expect(res.error, source).not.toBeNull();
    }
  });

  it("Free: can't enrol in a paid program or read its prescriptions; week and day names stay readable as a preview", async () => {
    const c = free.client;
    const enrol = await c.from("user_programs").insert({ user_id: free.id, program_id: paidProgram.id, status: "active", current_week: 1, current_day: 1 }).select();
    expect(enrol.error).not.toBeNull();
    const ex = await c.from("program_exercises").select("id").eq("day_id", paidDayId);
    expect(ex.data ?? []).toEqual([]);
    const days = await c.from("program_days").select("id").eq("id", paidDayId);
    expect(days.data).toHaveLength(1);
  });

  it("Free: saved workouts stop at 5", async () => {
    const c = free.client;
    for (let i = 1; i <= 5; i++) expect((await c.from("workout_templates").insert({ user_id: free.id, name: `T${i}` }).select()).error, `template ${i}`).toBeNull();
    expect((await c.from("workout_templates").insert({ user_id: free.id, name: "T6" }).select()).error).not.toBeNull();
  });

  it("Plus: the same writes work, and Pro adds AI programs", async () => {
    await setPlan(free, "plus");
    try {
      const c = free.client;
      expect((await c.from("recipes").insert({ user_id: free.id, name: "Allowed" }).select()).error).toBeNull();
      expect((await c.from("workout_templates").insert({ user_id: free.id, name: "T6" }).select()).error).toBeNull();
      const custom = await c.from("training_programs").insert({ owner_id: free.id, name: "Mine", slug: `mine-${free.id}`, source: "custom", is_published: false, tier: "free", difficulty: "beginner", session_minutes: 45, days_per_week: 3, duration_weeks: 4 }).select();
      expect(custom.error).toBeNull();
      expect((await c.from("program_exercises").select("id").eq("day_id", paidDayId)).data?.length).toBeGreaterThan(0);
      const ai = await c.from("training_programs").insert({ owner_id: free.id, name: "AI", slug: `ai-${free.id}`, source: "ai", is_published: false, tier: "free", difficulty: "beginner", session_minutes: 45, days_per_week: 3, duration_weeks: 4 }).select();
      expect(ai.error).not.toBeNull();
      await setPlan(free, "pro");
      const ai2 = await c.from("training_programs").insert({ owner_id: free.id, name: "AI", slug: `ai2-${free.id}`, source: "ai", is_published: false, tier: "free", difficulty: "beginner", session_minutes: 45, days_per_week: 3, duration_weeks: 4 }).select();
      expect(ai2.error).toBeNull();
    } finally {
      await setPlan(free, "free");
    }
  });

  it("an expired paid entitlement counts as Free", async () => {
    await serviceClient().from("user_entitlements").upsert({ user_id: free.id, plan: "plus", source: "stripe", valid_until: new Date(Date.now() - 60_000).toISOString() }, { onConflict: "user_id" });
    try {
      expect((await free.client.from("recipes").insert({ user_id: free.id, name: "Expired" }).select()).error).not.toBeNull();
    } finally {
      await setPlan(free, "free");
    }
  });
});
