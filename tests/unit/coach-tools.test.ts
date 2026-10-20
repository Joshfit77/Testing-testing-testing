import { describe, expect, it, vi } from "vitest";
import {
  checkNutritionTargets,
  coachProposalSchema,
  coachToolDefinitions,
  platesPerSide,
  roundLoadable,
  runCalculation,
  toolActivityLabel,
  TOOL_INPUT_SCHEMAS,
  TOOL_NAMES,
  validateToolInput,
  type ToolInput,
} from "@/lib/coach/tools";
import { executeCoachTool, type ToolContext } from "@/server/coach/tools";
import { athleteFixture, fakeSupabase } from "./fixtures/coach-fixtures";

vi.mock("@/server/services/usda-local", () => ({
  searchUsda: vi.fn(async (q: string) =>
    q.includes("oat")
      ? [
          {
            fdcId: 1,
            name: "Oats, regular and quick, not fortified, dry",
            usdaName: "Oats",
            category: "Breakfast Cereals",
            catIndex: 1,
            basis: { per100: { calories: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5, fiber_g: 10.1, sugar_g: 1, sodium_mg: 6 }, portions: [{ label: "1 cup", grams: 81 }] },
          },
        ]
      : [],
  ),
}));

const USER = "11111111-1111-1111-1111-111111111111";

function ctx(supabase: ToolContext["supabase"], overrides: Partial<ToolContext> = {}): ToolContext {
  return { supabase, userId: USER, timeZone: "UTC", snapshot: athleteFixture(), proposal: null, ...overrides };
}

const calcBase: ToolInput<"calculate"> = { operation: "e1rm", weight: null, reps: null, percent: null, unit: null, bar_weight: null, weekly_change_kg: null, activity: null };

describe("tool definitions", () => {
  it("are strict, fully required, closed objects matching the Zod schemas", () => {
    const defs = coachToolDefinitions();
    expect(defs.map((d) => d.name)).toEqual(TOOL_NAMES);
    for (const d of defs) {
      expect(d.strict).toBe(true);
      expect(d.eager_input_streaming).toBe(true);
      expect(d.description!.length).toBeGreaterThan(60);
      const schema = d.input_schema as unknown as { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
      expect(schema.additionalProperties).toBe(false);
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
      expect(Object.keys(schema.properties).sort()).toEqual(Object.keys(TOOL_INPUT_SCHEMAS[d.name as keyof typeof TOOL_INPUT_SCHEMAS].shape).sort());
      // Strict mode rejects numeric/string length constraints.
      expect(JSON.stringify(schema)).not.toMatch(/"(minimum|maximum|minLength|maxLength)"/);
    }
  });

  it("are deterministic (cache-stable prefix)", () => {
    expect(JSON.stringify(coachToolDefinitions())).toBe(JSON.stringify(coachToolDefinitions()));
  });
});

describe("tool input validation", () => {
  it("accepts valid input and rejects out-of-range, extra or malformed fields", () => {
    expect(validateToolInput("get_recent_workouts", { days: 14, limit: 6 }).ok).toBe(true);
    expect(validateToolInput("get_recent_workouts", { days: 0, limit: 6 }).ok).toBe(false);
    expect(validateToolInput("get_recent_workouts", { days: 14, limit: 6, user_id: "someone-else" }).ok).toBe(false);
    expect(validateToolInput("get_exercise_history", { exercise: "bench-press" }).ok).toBe(false);
    expect(validateToolInput("search_exercises", { query: "row", equipment: ["laser_cannon"], limit: 5 }).ok).toBe(false);
    expect(validateToolInput("propose_exercise_swap", { from_exercise_slug: "Bench Press!", to_exercise_slug: "push-up", scope: "next_workout", reason: "Shoulder" }).ok).toBe(false);
    expect(validateToolInput("propose_nutrition_targets", { calories: 500, protein_g: 100, carbs_g: 10, fat_g: 10, reason: "x".repeat(10) }).ok).toBe(false);
    expect(validateToolInput("propose_bodyweight_log", { weight: 82, unit: "kg", date: "19/10/2026", reason: "Weigh-in" }).ok).toBe(false);
    const bad = validateToolInput("calculate", { ...calcBase, operation: "sqrt" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("operation");
  });

  it("labels tool activity for the chat UI", () => {
    expect(toolActivityLabel("get_exercise_history", { exercise: "bench-press", sessions: 6 })).toBe("Checking your last 6 bench press sessions…");
    expect(toolActivityLabel("get_nutrition_summary", { days: 1 })).toBe("Checking today's food log…");
    expect(toolActivityLabel("get_food_nutrition", { query: "oats" })).toBe("Looking up oats in the USDA database…");
    expect(toolActivityLabel("nope", {})).toBe("Working…");
  });
});

describe("calculator", () => {
  const profile = { units: "metric" as const, sex: "male" as const, age: 34, heightCm: 178, weightKg: 83, goal: "lose_fat" as const, diet: "balanced" as const, activity: "light" as const, weeklyChangeKg: -0.5 };
  it("estimates 1RM, percentages and plate loading", () => {
    expect(runCalculation({ ...calcBase, operation: "e1rm", weight: 100, reps: 5 }, profile)).toMatchObject({ unit: "kg", e1rm: 116.67, rounded_loadable: 117.5 });
    expect(runCalculation({ ...calcBase, operation: "percent_of_1rm", weight: 140, percent: 85 }, profile)).toMatchObject({ exact: 119, loadable: 120 });
    expect(runCalculation({ ...calcBase, operation: "plates", weight: 142.5 }, profile)).toMatchObject({ bar: 20, perSide: [25, 25, 10, 1.25], loaded: 142.5, remainder: 0 });
    expect(platesPerSide(225, 45, "lb")).toEqual({ perSide: [45, 45], loaded: 225, remainder: 0 });
    expect(roundLoadable(101, "kg")).toBe(100);
    expect(runCalculation({ ...calcBase, operation: "convert_weight", weight: 100, unit: "kg" }, profile)).toEqual({ kg: 100, lb: 220.46 });
    expect(() => runCalculation({ ...calcBase, operation: "e1rm", weight: 100 }, profile)).toThrow(/reps is required/);
  });

  it("computes the calorie budget from the saved profile, with overrides", () => {
    const r = runCalculation({ ...calcBase, operation: "calorie_budget" }, profile) as { calories: number; maintenance: number; floored: boolean };
    expect(r.maintenance).toBeGreaterThan(2300);
    expect(r.calories).toBeLessThan(r.maintenance);
    const r2 = runCalculation({ ...calcBase, operation: "calorie_budget", weekly_change_kg: 0 }, profile) as { calories: number; maintenance: number };
    expect(Math.abs(r2.calories - r2.maintenance)).toBeLessThanOrEqual(10);
    expect(runCalculation({ ...calcBase, operation: "calorie_budget" }, { ...profile, age: null })).toHaveProperty("note");
  });

  it("guards nutrition targets: floor, macro math and protein range", () => {
    const ctx = { sex: "female" as const, weightKg: 60 };
    expect(checkNutritionTargets({ calories: 1800, protein_g: 120, carbs_g: 200, fat_g: 58 }, ctx)).toEqual([]);
    expect(checkNutritionTargets({ calories: 1100, protein_g: 100, carbs_g: 100, fat_g: 33 }, ctx)[0]).toMatch(/at least 1200 kcal/);
    expect(checkNutritionTargets({ calories: 2000, protein_g: 100, carbs_g: 100, fat_g: 20 }, ctx).join(" ")).toMatch(/doesn't match/);
    expect(checkNutritionTargets({ calories: 2000, protein_g: 250, carbs_g: 150, fat_g: 44 }, ctx).join(" ")).toMatch(/g\/kg/);
  });
});

describe("tool handlers (mocked Supabase, user-scoped)", () => {
  const programTables = {
    user_programs: {
      data: { id: "up1", current_week: 3, current_day: 2, program: { id: "p1", name: "Strength Builder", source: "starter", owner_id: USER, duration_weeks: 8, days_per_week: 3 } },
      error: null,
    },
    program_weeks: {
      data: {
        id: "w3",
        focus: "Volume",
        is_deload: false,
        program_days: [
          { id: "d2", day_number: 2, name: "Bench day", focus: "Upper", program_exercises: [{ id: "pe2", position: 0, sets: 4, reps: "5", duration_seconds: null, rest_seconds: 180, rpe: 8, intensity: null, exercise: { slug: "bench-press", name: "Bench Press" } }] },
          { id: "d1", day_number: 1, name: "Squat day", focus: "Lower", program_exercises: [{ id: "pe1", position: 0, sets: 4, reps: "5", duration_seconds: null, rest_seconds: 180, rpe: 8, intensity: null, exercise: { slug: "back-squat", name: "Back Squat" } }] },
        ],
      },
      error: null,
    },
    exercises: (calls: [string, unknown[]][]) => {
      const slugEq = calls.find(([m, a]) => m === "eq" && a[0] === "slug");
      return slugEq?.[1][1] === "dumbbell-bench-press" ? { data: { slug: "dumbbell-bench-press", name: "Dumbbell Bench Press" }, error: null } : { data: null, error: null };
    },
  };

  it("returns this week of the program with the next day marked", async () => {
    const { client, log } = fakeSupabase(programTables);
    const out = await executeCoachTool(ctx(client), "get_program_week", { week: null });
    expect(out.isError).toBe(false);
    const json = JSON.parse(out.content);
    expect(json).toMatchObject({ program: "Strength Builder", week: 3, editable: true });
    expect(json.days.map((d: { day: number }) => d.day)).toEqual([1, 2]);
    expect(json.days[1]).toMatchObject({ next: true, exercises: [{ slug: "bench-press", rest_seconds: 180 }] });
    const up = log.find((l) => l.table === "user_programs")!;
    expect(up.calls).toContainEqual(["eq", ["user_id", USER]]);
  });

  it("loads recent workouts filtered to the signed-in user, in their units", async () => {
    const { client, log } = fakeSupabase({
      workout_sessions: {
        data: [
          {
            name: "Bench day",
            started_at: "2026-10-17T17:00:00Z",
            total_volume_kg: 3200,
            workout_exercises: [
              {
                position: 0,
                skipped: false,
                skip_reason: null,
                exercise: { slug: "bench-press", name: "Bench Press" },
                sets: [
                  { set_number: 2, reps: 4, weight_kg: "100", duration_seconds: null, rpe: "9", completed: true, is_warmup: false },
                  { set_number: 1, reps: 5, weight_kg: "60", duration_seconds: null, rpe: null, completed: true, is_warmup: true },
                  { set_number: 3, reps: 3, weight_kg: "100", duration_seconds: null, rpe: null, completed: false, is_warmup: false },
                ],
              },
            ],
          },
        ],
        error: null,
      },
    });
    const out = await executeCoachTool(ctx(client, { snapshot: athleteFixture({ units: "imperial" }) }), "get_recent_workouts", { days: 14, limit: 5 });
    const json = JSON.parse(out.content);
    expect(json.unit).toBe("lb");
    expect(json.workouts[0].exercises[0]).toEqual({ exercise: "Bench Press", slug: "bench-press", sets: ["220.5 lb×4 @9"], e1rm: 249.8 });
    const calls = log.find((l) => l.table === "workout_sessions")!.calls;
    expect(calls).toContainEqual(["eq", ["user_id", USER]]);
    expect(calls).toContainEqual(["eq", ["status", "completed"]]);
    expect(calls).toContainEqual(["limit", [5]]);
  });

  it("looks up foods in the local USDA database", async () => {
    const { client } = fakeSupabase({});
    const out = await executeCoachTool(ctx(client), "get_food_nutrition", { query: "oats", grams: 50 });
    const json = JSON.parse(out.content);
    expect(json.results[0]).toMatchObject({ per_100g: { kcal: 379, protein_g: 13.2 }, per_50g: { kcal: 190, protein_g: 6.6 }, portions: ["1 cup = 81 g"] });
    const none = JSON.parse((await executeCoachTool(ctx(client), "get_food_nutrition", { query: "unobtainium", grams: null })).content);
    expect(none.results).toEqual([]);
  });

  it("proposes (never applies) an exercise swap after validating both slugs", async () => {
    const { client, log } = fakeSupabase(programTables);
    const c = ctx(client);
    const out = await executeCoachTool(c, "propose_exercise_swap", { from_exercise_slug: "bench-press", to_exercise_slug: "dumbbell-bench-press", scope: "rest_of_program", reason: "Easier on the shoulder." });
    expect(out.isError).toBe(false);
    expect(JSON.parse(out.content)).toMatchObject({ status: "shown_to_athlete_for_confirmation", applied: false });
    expect(out.proposal).toEqual({
      kind: "exercise_swap",
      from: { slug: "bench-press", name: "Bench Press" },
      to: { slug: "dumbbell-bench-press", name: "Dumbbell Bench Press" },
      scope: "rest_of_program",
      reason: "Easier on the shoulder.",
      programName: "Strength Builder",
      editable: true,
    });
    expect(coachProposalSchema.safeParse(out.proposal).success).toBe(true);
    // Read-only: no writes of any kind.
    expect(log.flatMap((l) => l.calls.map(([m]) => m))).not.toEqual(expect.arrayContaining(["insert"]));
    for (const m of ["insert", "update", "upsert", "delete"]) expect(log.some((l) => l.calls.some(([x]) => x === m))).toBe(false);

    const unknownTo = await executeCoachTool(ctx(client), "propose_exercise_swap", { from_exercise_slug: "bench-press", to_exercise_slug: "made-up-move", scope: "next_workout", reason: "Because." });
    expect(unknownTo.isError).toBe(true);
    expect(unknownTo.proposal).toBeUndefined();
    const notInProgram = await executeCoachTool(ctx(client), "propose_exercise_swap", { from_exercise_slug: "deadlift", to_exercise_slug: "dumbbell-bench-press", scope: "next_workout", reason: "Because." });
    expect(notInProgram.isError).toBe(true);
  });

  it("allows only one proposal per reply", async () => {
    const { client } = fakeSupabase({});
    const c = ctx(client);
    const first = await executeCoachTool(c, "propose_bodyweight_log", { weight: 183, unit: "lb", date: null, reason: "Morning weigh-in." });
    expect(first.proposal).toMatchObject({ kind: "bodyweight_log", weightKg: 83.01, date: "2026-10-19", display: "83 kg" });
    c.proposal = first.proposal!;
    const second = await executeCoachTool(c, "propose_nutrition_targets", { calories: 2300, protein_g: 180, carbs_g: 230, fat_g: 72, reason: "Slower cut." });
    expect(second.isError).toBe(true);
    expect(second.content).toMatch(/Only one change/);
  });

  it("rejects unsafe nutrition targets and future bodyweight dates", async () => {
    const { client } = fakeSupabase({});
    const low = await executeCoachTool(ctx(client), "propose_nutrition_targets", { calories: 1300, protein_g: 150, carbs_g: 100, fat_g: 34, reason: "Aggressive cut." });
    expect(low.isError).toBe(true);
    expect(low.content).toMatch(/1500 kcal/);
    const ok = await executeCoachTool(ctx(client), "propose_nutrition_targets", { calories: 2300, protein_g: 180, carbs_g: 230, fat_g: 72, reason: "Slower cut." });
    expect(ok.proposal).toMatchObject({ kind: "nutrition_targets", calories: 2300, previous: { calories: 2330 } });
    const future = await executeCoachTool(ctx(client), "propose_bodyweight_log", { weight: 82, unit: "kg", date: "2026-12-01", reason: "Future." });
    expect(future.isError).toBe(true);
  });

  it("returns validation errors to the model instead of running the tool", async () => {
    const { client, log } = fakeSupabase({});
    const out = await executeCoachTool(ctx(client), "get_recent_workouts", { days: "all", limit: 5 });
    expect(out.isError).toBe(true);
    expect(JSON.parse(out.content)).toHaveProperty("INVALID_INPUT");
    expect(log).toHaveLength(0);
    expect((await executeCoachTool(ctx(client), "drop_tables", {})).isError).toBe(true);
  });

  it("answers calculations exactly", async () => {
    const { client } = fakeSupabase({});
    const out = await executeCoachTool(ctx(client), "calculate", { ...calcBase, operation: "plates", weight: 100 });
    expect(JSON.parse(out.content)).toMatchObject({ unit: "kg", perSide: [25, 15], loaded: 100 });
    const missing = await executeCoachTool(ctx(client), "calculate", { ...calcBase, operation: "e1rm", weight: 100 });
    expect(missing.isError).toBe(true);
    expect(missing.content).toMatch(/reps is required/);
  });
});
