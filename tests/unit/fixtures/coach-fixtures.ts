import type { AthleteSnapshot } from "@/lib/coach/context";

/** A realistic intermediate lifter (metric) with a stalled bench, an active own program and food logs. */
export function athleteFixture(overrides: Partial<AthleteSnapshot> = {}): AthleteSnapshot {
  const bench = (weightKg: number, reps: number, rpe: number) => ({
    slug: "bench-press",
    name: "Bench Press",
    skipped: false,
    skipReason: null,
    sets: [
      { reps, weightKg, seconds: null, rpe },
      { reps: reps - 1, weightKg, seconds: null, rpe: rpe + 0.5 },
    ],
  });
  const squat = (weightKg: number) => ({ slug: "back-squat", name: "Back Squat", skipped: false, skipReason: null, sets: [{ reps: 5, weightKg, seconds: null, rpe: 8 }] });
  return {
    today: "2026-10-19",
    units: "metric",
    age: 34,
    sex: "male",
    heightCm: 178,
    goal: "build_strength",
    experience: "intermediate",
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipment: ["barbell", "rack", "bench", "dumbbell"],
    preferredTypes: ["strength"],
    dietType: "high_protein",
    limitations: null,
    goalWeightKg: 80,
    weeklyChangeKg: -0.25,
    activity: "light",
    budget: { maintenance: 2600, calories: 2330, protein_g: 185, carbs_g: 220, fat_g: 75, floored: false },
    targets: { calories: 2330, protein_g: 185, carbs_g: 220, fat_g: 75, water_ml: 3000, isEstimate: true },
    todayIntake: { calories: 900, protein: 70, carbs: 80, fat: 30, items: 4 },
    nutritionWeek: [
      { date: "2026-10-17", calories: 2200, protein: 160 },
      { date: "2026-10-18", calories: 2400, protein: 175 },
      { date: "2026-10-19", calories: 900, protein: 70 },
    ],
    program: {
      name: "Strength Builder",
      source: "starter",
      editable: true,
      week: 3,
      durationWeeks: 8,
      daysPerWeek: 3,
      nextDay: 2,
      weekFocus: "Volume",
      isDeload: false,
      days: [
        { dayNumber: 1, name: "Squat day", focus: "Lower", exercises: [{ slug: "back-squat", name: "Back Squat", sets: 4, reps: "5", seconds: null, rpe: 8, intensity: null }] },
        { dayNumber: 2, name: "Bench day", focus: "Upper", exercises: [{ slug: "bench-press", name: "Bench Press", sets: 4, reps: "5", seconds: null, rpe: 8, intensity: null }] },
        { dayNumber: 3, name: "Pull day", focus: "Back", exercises: [{ slug: "plank", name: "Plank", sets: 3, reps: null, seconds: 45, rpe: null, intensity: null }] },
      ],
    },
    workouts: [
      { date: "2026-10-17", name: "Bench day", volumeKg: 3200, exercises: [bench(100, 4, 9), { slug: "barbell-row", name: "Barbell Row", skipped: true, skipReason: "pain", sets: [] }] },
      { date: "2026-10-15", name: "Squat day", volumeKg: 4100, exercises: [squat(140)] },
      { date: "2026-10-13", name: "Bench day", volumeKg: 3300, exercises: [bench(100, 5, 8.5)] },
      { date: "2026-10-10", name: "Squat day", volumeKg: 4000, exercises: [squat(135)] },
      { date: "2026-10-08", name: "Bench day", volumeKg: 3300, exercises: [bench(100, 5, 8)] },
    ],
    sessionDates: ["2026-10-08", "2026-10-10", "2026-10-13", "2026-10-15", "2026-10-17"],
    prs: [{ name: "Bench Press", slug: "bench-press", e1rmKg: 116.67, achievedOn: "2026-10-08" }],
    weights: [
      { date: "2026-09-25", kg: 84 },
      { date: "2026-10-05", kg: 83.4 },
      { date: "2026-10-19", kg: 83 },
    ],
    steps: [
      { date: "2026-10-18", steps: 9000 },
      { date: "2026-10-19", steps: 7000 },
    ],
    stepGoal: 8000,
    supplements: ["Creatine monohydrate"],
    readiness: { score: 72, date: "2026-10-19" },
    challenge: null,
    faithEnabled: false,
    ...overrides,
  };
}

export function emptyAthlete(): AthleteSnapshot {
  return athleteFixture({
    goal: null,
    experience: null,
    daysPerWeek: null,
    sessionMinutes: null,
    equipment: [],
    preferredTypes: [],
    dietType: null,
    goalWeightKg: null,
    weeklyChangeKg: null,
    activity: null,
    budget: null,
    targets: null,
    todayIntake: { calories: 0, protein: 0, carbs: 0, fat: 0, items: 0 },
    nutritionWeek: [],
    program: null,
    workouts: [],
    sessionDates: [],
    prs: [],
    weights: [],
    steps: [],
    supplements: [],
    readiness: null,
  });
}

type Result = { data: unknown; error: unknown; count?: number };

/**
 * Minimal chainable Supabase fake: `from(table)` records every filter call and resolves to the
 * configured result for that table (or a function of the recorded calls).
 */
export function fakeSupabase(tables: Record<string, Result | ((calls: [string, unknown[]][]) => Result)>) {
  const log: { table: string; calls: [string, unknown[]][] }[] = [];
  const from = (table: string) => {
    const calls: [string, unknown[]][] = [];
    log.push({ table, calls });
    const resolve = (): Result => {
      const r = tables[table];
      if (!r) return { data: null, error: null };
      return typeof r === "function" ? r(calls) : r;
    };
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "gte", "lte", "in", "ilike", "order", "limit", "insert", "update", "upsert", "delete"]) {
      builder[m] = (...args: unknown[]) => {
        calls.push([m, args]);
        return builder;
      };
    }
    builder.maybeSingle = async () => {
      const r = resolve();
      return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
    };
    builder.single = builder.maybeSingle;
    builder.then = (onFulfilled: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
    return builder;
  };
  return { client: { from } as unknown as import("@supabase/supabase-js").SupabaseClient, log };
}
