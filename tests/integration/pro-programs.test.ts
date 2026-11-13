import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * 2026-11 owner rule: structured programs are Pro for new enrollments. Members who enrolled before keep their
 * program (and its prescriptions); switching programs keeps completed history. Checked as the member (RLS applies).
 */
describe.skipIf(!available)("Pro-only structured programs, with existing enrollments kept", () => {
  let free: TestUser;
  let grandfathered: TestUser;
  let pro: TestUser;
  let programA: string;
  let programB: string;
  let dayA: string;

  const setPlan = async (u: TestUser, plan: "free" | "pro") => {
    const { error } = await serviceClient().from("user_entitlements").upsert({ user_id: u.id, plan, source: plan === "free" ? "default" : "admin" }, { onConflict: "user_id" });
    expect(error).toBeNull();
  };

  beforeAll(async () => {
    [free, grandfathered, pro] = await Promise.all([createTestUser("prog-free"), createTestUser("prog-grand"), createTestUser("prog-pro")]);
    const svc = serviceClient();
    const { data: programs } = await svc.from("training_programs").select("id, slug").is("owner_id", null).in("slug", ["beginner-strength-foundations-8-week", "full-body-fitness-foundations"]);
    programA = programs!.find((p) => p.slug === "beginner-strength-foundations-8-week")!.id as string;
    programB = programs!.find((p) => p.slug === "full-body-fitness-foundations")!.id as string;
    const { data: week } = await svc.from("program_weeks").select("id").eq("program_id", programA).eq("week_number", 1).single();
    const { data: day } = await svc.from("program_days").select("id").eq("week_id", week!.id).order("day_number").limit(1).single();
    dayA = day!.id as string;
    await setPlan(pro, "pro");
    // Enrolled while the program was open to them; the plan is Free now.
    const { error } = await svc.from("user_programs").insert({ user_id: grandfathered.id, program_id: programA, status: "active" });
    expect(error).toBeNull();
  });
  afterAll(async () => Promise.all([free, grandfathered, pro].filter(Boolean).map((u) => deleteTestUser(u))));

  it("the new catalog programs are published, Pro-tier and fully built", async () => {
    const { data } = await serviceClient().from("training_programs").select("slug, tier, is_published, duration_weeks").in("id", [programA, programB]);
    for (const p of data!) {
      expect(p.tier, p.slug).toBe("pro");
      expect(p.is_published).toBe(true);
      const { count } = await serviceClient().from("program_weeks").select("id", { count: "exact", head: true }).eq("program_id", (p.slug === "full-body-fitness-foundations" ? programB : programA));
      expect(count).toBe(p.duration_weeks);
    }
  });

  it("Free: can't enroll, and can't create the 'earlier enrollment' row that would unlock a program", async () => {
    const { error } = await free.client.from("user_programs").insert({ user_id: free.id, program_id: programA, status: "active" });
    expect(error).not.toBeNull();
    const { data: rows } = await serviceClient().from("user_programs").select("id").eq("user_id", free.id);
    expect(rows).toEqual([]);
    // And the prescriptions stay hidden.
    const { data: ex } = await free.client.from("program_exercises").select("id").eq("day_id", dayA);
    expect(ex).toEqual([]);
  });

  it("Free with an earlier enrollment: keeps reading the program and logging against it", async () => {
    const { data: ex } = await grandfathered.client.from("program_exercises").select("id").eq("day_id", dayA);
    expect(ex!.length).toBeGreaterThan(0);
    const { data: up } = await grandfathered.client.from("user_programs").select("id").eq("program_id", programA).single();
    const { error } = await grandfathered.client.from("workout_sessions").insert({ user_id: grandfathered.id, user_program_id: up!.id, program_day_id: dayA, name: "Day 1", client_id: crypto.randomUUID(), status: "completed", started_at: new Date().toISOString(), ended_at: new Date().toISOString() });
    expect(error).toBeNull();
    // ...but can't use it to start a different Pro program.
    const other = await grandfathered.client.from("user_programs").insert({ user_id: grandfathered.id, program_id: programB, status: "active" });
    expect(other.error).not.toBeNull();
  });

  it("Pro: enrolls; switching pauses the old program and keeps its completed workouts", async () => {
    const a = await pro.client.from("user_programs").insert({ user_id: pro.id, program_id: programA, status: "active" }).select("id").single();
    expect(a.error).toBeNull();
    const now = new Date().toISOString();
    const done = await pro.client.from("workout_sessions").insert({ user_id: pro.id, user_program_id: a.data!.id, program_day_id: dayA, name: "Day 1", client_id: crypto.randomUUID(), status: "completed", started_at: now, ended_at: now }).select("id").single();
    expect(done.error).toBeNull();
    // The switch the app (and an approved AI suggestion) performs: pause the active run, start the new one.
    expect((await pro.client.from("user_programs").update({ status: "paused" }).eq("user_id", pro.id).eq("status", "active")).error).toBeNull();
    const b = await pro.client.from("user_programs").insert({ user_id: pro.id, program_id: programB, status: "active" }).select("id").single();
    expect(b.error).toBeNull();
    const { data: runs } = await pro.client.from("user_programs").select("program_id, status").eq("user_id", pro.id);
    expect(runs).toEqual(expect.arrayContaining([{ program_id: programA, status: "paused" }, { program_id: programB, status: "active" }]));
    const { data: history } = await pro.client.from("workout_sessions").select("id, user_program_id, program_day_id").eq("id", done.data!.id).single();
    expect(history).toEqual({ id: done.data!.id, user_program_id: a.data!.id, program_day_id: dayA });
  });

  it("habit programs: Free can't enroll, Pro can; one active run per program; ticks stay with the member", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const f = await free.client.from("habit_program_enrollments").insert({ user_id: free.id, program_slug: "nutrition-foundations", started_on: today, goals: {} });
    expect(f.error).not.toBeNull();
    const p = await pro.client.from("habit_program_enrollments").insert({ user_id: pro.id, program_slug: "nutrition-foundations", started_on: today, goals: {} }).select("id").single();
    expect(p.error).toBeNull();
    const dup = await pro.client.from("habit_program_enrollments").insert({ user_id: pro.id, program_slug: "nutrition-foundations", started_on: today, goals: {} });
    expect(dup.error?.code).toBe("23505");
    const tick = await pro.client.from("habit_program_checkins").insert({ enrollment_id: p.data!.id, user_id: pro.id, day_number: 1, activity_key: "protein", checked_on: today });
    expect(tick.error).toBeNull();
    // Another member can't see or tick it.
    const { data: seen } = await free.client.from("habit_program_checkins").select("id").eq("enrollment_id", p.data!.id);
    expect(seen).toEqual([]);
    const foreign = await free.client.from("habit_program_checkins").insert({ enrollment_id: p.data!.id, user_id: free.id, day_number: 2, activity_key: "protein", checked_on: today });
    expect(foreign.error).not.toBeNull();
    // Stopping keeps the record; a new run can start later.
    expect((await pro.client.from("habit_program_enrollments").update({ status: "stopped", stopped_at: new Date().toISOString() }).eq("id", p.data!.id)).error).toBeNull();
    const again = await pro.client.from("habit_program_enrollments").insert({ user_id: pro.id, program_slug: "nutrition-foundations", started_on: today, goals: {} });
    expect(again.error).toBeNull();
    const { count } = await pro.client.from("habit_program_checkins").select("id", { count: "exact", head: true }).eq("enrollment_id", p.data!.id);
    expect(count).toBe(1);
  });
});
