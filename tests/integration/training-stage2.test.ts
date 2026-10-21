import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/server/services/account";
import { createTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from "@/server/services/templates";
import { finishWorkout, getPreviousPerformance } from "@/server/services/workouts";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Stage 2B: saved workout templates (RLS, constraints, export, cascade), distance sets, previous performance, flags. */
describe.skipIf(!available)("training stage 2B: templates, distance, previous performance", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let ids: Record<string, string>;
  let templateId: string;

  beforeAll(async () => {
    [alice, bob, admin] = await Promise.all([createTestUser("tpl-alice"), createTestUser("tpl-bob"), createTestUser("tpl-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    ids = await exerciseIds(["bench-press", "one-arm-dumbbell-row", "farmers-carry"]);
    templateId = await createTemplate(alice.client, alice.id, {
      name: "Push pull carry",
      notes: null,
      exercises: [
        { exerciseId: ids["bench-press"]!, sets: 3, target: "reps", reps: "8", durationSeconds: null, distanceM: null, restSeconds: 120, supersetGroup: 1, notes: null },
        { exerciseId: ids["one-arm-dumbbell-row"]!, sets: 3, target: "reps", reps: "10", durationSeconds: null, distanceM: null, restSeconds: 90, supersetGroup: 1, notes: null },
        { exerciseId: ids["farmers-carry"]!, sets: 2, target: "distance", reps: null, durationSeconds: null, distanceM: 40, restSeconds: 60, supersetGroup: null, notes: null },
      ],
    });
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(alice), deleteTestUser(bob), deleteTestUser(admin)]);
  });

  it("owners create, read, update and delete their templates", async () => {
    const t = await getTemplate(alice.client, alice.id, templateId);
    expect(t?.exercises.map((e) => [e.slug, e.supersetGroup, e.target])).toEqual([
      ["bench-press", 1, "reps"],
      ["one-arm-dumbbell-row", 1, "reps"],
      ["farmers-carry", null, "distance"],
    ]);
    expect(t?.exercises[2]!.distanceM).toBe(40);
    await updateTemplate(alice.client, alice.id, templateId, {
      name: "Push pull",
      notes: "Edited",
      exercises: t!.exercises.slice(0, 2).map((e) => ({ ...e, sets: 4 })),
    });
    const after = await getTemplate(alice.client, alice.id, templateId);
    expect(after?.name).toBe("Push pull");
    expect(after?.exercises.map((e) => e.sets)).toEqual([4, 4]);
    expect((await listTemplates(alice.client, alice.id)).length).toBe(1);
  });

  it("other users and admins can't read, change or delete them", async () => {
    for (const client of [bob.client, admin.client]) {
      for (const t of ["workout_templates", "workout_template_exercises"]) {
        const { data } = await client.from(t).select("*").eq("user_id", alice.id);
        expect(data, t).toEqual([]);
      }
      const upd = await client.from("workout_templates").update({ name: "pwned" }).eq("id", templateId).select("id");
      expect(upd.data).toEqual([]);
      const del = await client.from("workout_template_exercises").delete().eq("template_id", templateId).select("id");
      expect(del.data).toEqual([]);
    }
    expect(await getTemplate(bob.client, bob.id, templateId)).toBeNull();
    await expect(deleteTemplate(bob.client, bob.id, templateId)).rejects.toThrow(/not found/);
    await expect(updateTemplate(bob.client, bob.id, templateId, { name: "x", notes: null, exercises: [] })).rejects.toThrow(/not found/);
  });

  it("nobody can plant exercises into another user's template", async () => {
    const plant = await bob.client
      .from("workout_template_exercises")
      .insert({ template_id: templateId, user_id: bob.id, exercise_id: ids["bench-press"], position: 9, sets: 1, target: "reps", reps: "5" });
    expect(plant.error).not.toBeNull();
    const spoof = await bob.client.from("workout_templates").insert({ user_id: alice.id, name: "spoof" });
    expect(spoof.error).not.toBeNull();
  });

  it("enforces the constraints", async () => {
    const c = alice.client;
    const noTarget = await c.from("workout_template_exercises").insert({ template_id: templateId, user_id: alice.id, exercise_id: ids["bench-press"], position: 10, sets: 3, target: "time" });
    expect(noTarget.error).not.toBeNull();
    const tooMany = await c.from("workout_template_exercises").insert({ template_id: templateId, user_id: alice.id, exercise_id: ids["bench-press"], position: 11, sets: 50, target: "reps", reps: "5" });
    expect(tooMany.error).not.toBeNull();
    const blank = await c.from("workout_templates").insert({ user_id: alice.id, name: "" });
    expect(blank.error).not.toBeNull();
  });

  it("logs distance and returns the previous performance for the next workout", async () => {
    const started = new Date(Date.now() - 3600_000).toISOString();
    await finishWorkout(alice.client, alice.id, {
      clientId: crypto.randomUUID(),
      name: "Push pull",
      userProgramId: null,
      programDayId: null,
      startedAt: started,
      endedAt: new Date().toISOString(),
      pausedSeconds: 0,
      notes: "",
      exercises: [
        {
          exerciseId: ids["bench-press"]!,
          substitutedFromId: null,
          notes: "",
          skipped: false,
          skipReason: null,
          sets: [1, 2, 3].map(() => ({ reps: 5, weightKg: 102.06, durationSeconds: null, distanceM: null, rpe: 8, isWarmup: false, completed: true })),
        },
        {
          exerciseId: ids["farmers-carry"]!,
          substitutedFromId: null,
          notes: "",
          skipped: false,
          skipReason: null,
          sets: [{ reps: null, weightKg: 32, durationSeconds: 30, distanceM: 40, rpe: null, isWarmup: false, completed: true }],
        },
      ],
    });
    const { data: sets } = await alice.client.from("workout_sets").select("distance_m").eq("user_id", alice.id).not("distance_m", "is", null);
    expect(sets?.map((s) => Number(s.distance_m))).toEqual([40]);
    const prev = await getPreviousPerformance(alice.client, alice.id, [ids["bench-press"]!, ids["farmers-carry"]!, ids["one-arm-dumbbell-row"]!]);
    expect(prev[ids["bench-press"]!]!.sets.filter((s) => s.completed)).toHaveLength(3);
    expect(prev[ids["farmers-carry"]!]!.sets[0]!.distanceM).toBe(40);
    expect(prev[ids["one-arm-dumbbell-row"]!]).toBeUndefined();
    // Bob sees none of it.
    expect(await getPreviousPerformance(bob.client, bob.id, [ids["bench-press"]!])).toEqual({});
  });

  it("users can save their rest-timer alert setting; specialist flags are readable", async () => {
    const { error } = await alice.client.from("profiles").update({ rest_timer_sound: false, rest_timer_vibrate: true }).eq("id", alice.id);
    expect(error).toBeNull();
    const { data } = await alice.client.from("profiles").select("rest_timer_sound, rest_timer_vibrate").eq("id", alice.id).single();
    expect(data).toEqual({ rest_timer_sound: false, rest_timer_vibrate: true });
    const { data: flagged } = await alice.client.from("training_programs").select("slug").eq("needs_specialist_review", true).eq("is_published", true);
    expect(flagged?.map((p) => p.slug)).toEqual(expect.arrayContaining(["physique-show-prep", "seated-strength-mobility"]));
    // Users can't flip the flag on curated programs.
    const upd = await alice.client.from("training_programs").update({ needs_specialist_review: false }).eq("slug", "physique-show-prep").select("id");
    expect(upd.data ?? []).toEqual([]);
  });

  it("is included in the data export", async () => {
    const out = await exportUserData(alice.client, alice.id, alice.email);
    expect((out.workout_templates as unknown[]).length).toBe(1);
    expect((out.workout_template_exercises as unknown[]).length).toBe(2);
    expect(JSON.stringify(out)).not.toContain(bob.id);
  });

  it("cascades away with the account", async () => {
    const temp = await createTestUser("tpl-temp");
    await createTemplate(temp.client, temp.id, {
      name: "Gone",
      notes: null,
      exercises: [{ exerciseId: ids["bench-press"]!, sets: 3, target: "reps", reps: "5", durationSeconds: null, distanceM: null, restSeconds: 90, supersetGroup: null, notes: null }],
    });
    await deleteTestUser(temp);
    const svc = serviceClient();
    for (const t of ["workout_templates", "workout_template_exercises"]) {
      const { count } = await svc.from(t).select("*", { count: "exact", head: true }).eq("user_id", temp.id);
      expect(count, t).toBe(0);
    }
  });
});
