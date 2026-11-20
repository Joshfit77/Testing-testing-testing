import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * A member's own (unpublished) training program, all the way down: the program, its weeks, days and exercises.
 * cross-user-isolation.test.ts covers the program row; these child tables are readable by visitors for the public
 * catalog, so their policies decide by the parent program. Here another member (with the top plan, so only ownership
 * can stop him), an admin and a signed-out visitor try to read, add to, change and delete each level, through the
 * public API.
 */
const available = await stackAvailable();

describe.skipIf(!available)("a member's private training program is invisible and untouchable to others", () => {
  const svc = serviceClient();
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  const ids = { program: "", week: "", day: "", exercise: "" };
  let squat = "";

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("prog-alice"), createTestUser("prog-bob"), createTestUser("prog-admin")]);
    await Promise.all([grantPlan(alice, "pro"), grantPlan(bob, "pro")]);
    const { error: roleErr } = await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (roleErr) throw roleErr;
    squat = (await exerciseIds(["back-squat"]))["back-squat"]!;
    const seed = async (table: string, row: Record<string, unknown>) => {
      const { data, error } = await svc.from(table).insert(row).select("id").single();
      if (error) throw new Error(`seeding ${table}: ${error.message}`);
      return (data as { id: string }).id;
    };
    ids.program = await seed("training_programs", {
      slug: `prog-private-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: "Alice's private plan",
      difficulty: "beginner",
      duration_weeks: 1,
      days_per_week: 1,
      session_minutes: 30,
      owner_id: alice.id,
      source: "ai",
      is_published: false,
    });
    ids.week = await seed("program_weeks", { program_id: ids.program, week_number: 1 });
    ids.day = await seed("program_days", { week_id: ids.week, day_number: 1, name: "Alice day 1" });
    ids.exercise = await seed("program_exercises", { day_id: ids.day, exercise_id: squat, position: 0, sets: 3, reps: "5" });
  });

  afterAll(async () => {
    await svc.from("training_programs").delete().eq("id", ids.program);
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  const levels = [
    { table: "training_programs", key: "program" },
    { table: "program_weeks", key: "week" },
    { table: "program_days", key: "day" },
    { table: "program_exercises", key: "exercise" },
  ] as const;

  it("Alice sees every level of her own program (so the checks below aren't vacuous)", async () => {
    for (const { table, key } of levels) {
      const { data, error } = await alice.client.from(table).select("id").eq("id", ids[key]);
      expect(error, table).toBeNull();
      expect(data?.length, table).toBe(1);
    }
  });

  it("another member, an admin and a signed-out visitor see none of it, by id or by parent", async () => {
    // Admins manage the shared library (programs with no owner); a member's own plan isn't theirs to read (migration 083).
    for (const who of [bob.client, admin.client, anonClient()]) {
      for (const { table, key } of levels) {
        const { data } = await who.from(table).select("id").eq("id", ids[key]);
        expect(data ?? [], table).toEqual([]);
      }
      expect((await who.from("program_weeks").select("id").eq("program_id", ids.program)).data ?? []).toEqual([]);
      expect((await who.from("program_days").select("id").eq("week_id", ids.week)).data ?? []).toEqual([]);
      expect((await who.from("program_exercises").select("id").eq("day_id", ids.day)).data ?? []).toEqual([]);
    }
  });

  it("another member can't add a week, day or exercise to it", async () => {
    const tries = [
      bob.client.from("program_weeks").insert({ program_id: ids.program, week_number: 2 }),
      bob.client.from("program_days").insert({ week_id: ids.week, day_number: 2, name: "Bob's day" }),
      bob.client.from("program_exercises").insert({ day_id: ids.day, exercise_id: squat, position: 1, sets: 9, reps: "5" }),
    ];
    for (const r of await Promise.all(tries)) expect(r.error?.code).toBe("42501");
    const { count } = await svc.from("program_weeks").select("id", { count: "exact", head: true }).eq("program_id", ids.program);
    expect(count).toBe(1);
  });

  it("an admin still reads and edits the shared library (owner-less programs)", async () => {
    const { data: library } = await admin.client.from("training_programs").select("id").is("owner_id", null).limit(1);
    expect(library?.length).toBe(1);
    const { data: weeks } = await admin.client.from("program_weeks").select("id").eq("program_id", library![0]!.id).limit(1);
    expect(weeks?.length).toBe(1);
  });

  it("an admin can't link his own records to her private program", async () => {
    const r = await admin.client.from("user_programs").insert({ user_id: admin.id, program_id: ids.program });
    // Refused by the enrolment policy (42501) or the reference check (23503); either way nothing is linked.
    expect(["42501", "23503"]).toContain(r.error?.code);
    const { count } = await svc.from("user_programs").select("id", { count: "exact", head: true }).eq("program_id", ids.program);
    expect(count).toBe(0);
  });

  it("another member can't change or delete any level (nothing is touched)", async () => {
    await bob.client.from("training_programs").update({ name: "pwned" }).eq("id", ids.program);
    await bob.client.from("program_weeks").update({ focus: "pwned" }).eq("id", ids.week);
    await bob.client.from("program_days").update({ name: "pwned" }).eq("id", ids.day);
    await bob.client.from("program_exercises").update({ sets: 99 }).eq("id", ids.exercise);
    for (const { table, key } of [...levels].reverse()) await bob.client.from(table).delete().eq("id", ids[key]);

    const [p, w, d, e] = await Promise.all([
      svc.from("training_programs").select("name").eq("id", ids.program).single(),
      svc.from("program_weeks").select("focus").eq("id", ids.week).single(),
      svc.from("program_days").select("name").eq("id", ids.day).single(),
      svc.from("program_exercises").select("sets").eq("id", ids.exercise).single(),
    ]);
    expect(p.data?.name).toBe("Alice's private plan");
    expect(w.data?.focus).not.toBe("pwned");
    expect(d.data?.name).toBe("Alice day 1");
    expect(e.data?.sets).toBe(3);
  });

  it("another member can't move a week of his own into her program, or hers into his", async () => {
    const own = await bob.client.from("training_programs").insert({
      slug: `prog-bob-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: "Bob's plan",
      difficulty: "beginner",
      duration_weeks: 1,
      days_per_week: 1,
      session_minutes: 30,
      owner_id: bob.id,
      source: "custom",
      is_published: false,
    }).select("id").single();
    // If members can't create programs directly, the re-parenting probe needs a seeded one.
    const bobProgram = own.data?.id ?? (await svc.from("training_programs").insert({
      slug: `prog-bob-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      name: "Bob's plan",
      difficulty: "beginner",
      duration_weeks: 1,
      days_per_week: 1,
      session_minutes: 30,
      owner_id: bob.id,
      source: "ai",
      is_published: false,
    }).select("id").single()).data!.id;
    try {
      const bobWeek = (await svc.from("program_weeks").insert({ program_id: bobProgram, week_number: 1 }).select("id").single()).data!.id;
      const into = await bob.client.from("program_weeks").update({ program_id: ids.program }).eq("id", bobWeek).select("id");
      expect(into.error?.code ?? (into.data?.length === 0 ? "none" : "moved")).not.toBe("moved");
      const steal = await bob.client.from("program_weeks").update({ program_id: bobProgram }).eq("id", ids.week).select("id");
      expect(steal.data ?? []).toEqual([]);
      const weeks = await svc.from("program_weeks").select("id, program_id").in("id", [bobWeek, ids.week]);
      expect(Object.fromEntries((weeks.data ?? []).map((r) => [r.id, r.program_id]))).toEqual({ [bobWeek]: bobProgram, [ids.week]: ids.program });
    } finally {
      await svc.from("training_programs").delete().eq("id", bobProgram);
    }
  });
});
