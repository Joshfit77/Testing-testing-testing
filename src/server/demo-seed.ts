/**
 * The demo's sample data (the "returning customer"): about two months of made-up workouts, food, runs, sleep and Faith
 * history for one account, written with the service role. Used by scripts/demo/seed-demo.ts (first seed) and by the
 * demo bar's Reset demo (src/server/actions/demo.ts), which wipes the sample account's rows and seeds them again.
 * Nothing here chooses the account or the project: the caller does, after its own safety checks.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { basisFromFoodRow, basisUnits, computeAmount } from "@/lib/domain/food-basis";
import { removeUserStorage, USER_TABLES } from "@/server/services/account";

const TZ = "America/New_York";
const SAMPLE = "Sample data for the demo";

function fail(message: string): never {
  throw new Error(`seed-demo: ${message}`);
}

// ---------- Dates in the member's time zone

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const TODAY = ymd(new Date());
function dayOffset(days: number): string {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}
/** The instant of a local wall-clock time on a date in TZ. */
function at(date: string, hour: number, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hour, minute);
  const local = new Date(new Date(guess).toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess - (local.getTime() - utc.getTime()));
}
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
const isoDow = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Monday

// ---------- Small helpers

let db: SupabaseClient;
async function insert<T = { id: string }>(table: string, rows: Record<string, unknown> | Record<string, unknown>[], select = "id"): Promise<T[]> {
  const { data, error } = await db.from(table).insert(rows).select(select);
  if (error) fail(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}
async function idsBySlug(table: string, slugs: string[]): Promise<Map<string, string>> {
  const { data, error } = await db.from(table).select("id, slug").in("slug", slugs);
  if (error) fail(`${table}: ${error.message}`);
  const map = new Map((data ?? []).map((r) => [r.slug as string, r.id as string]));
  const missing = slugs.filter((s) => !map.has(s));
  if (missing.length) fail(`${table} not found: ${missing.join(", ")} (is the database seeded?)`);
  return map;
}
const round = (kg: number, step = 2.5) => Math.round(kg / step) * step;
const topReps = (reps: string | null) => Math.max(...(reps ?? "8").replace(/ per side/i, "").split("-").map(Number).filter(Number.isFinite), 1);


/** The sample member's profile, onboarding answers, nutrition goals and the server-held Pro test entitlement. */
export async function seedSampleProfile(id: string): Promise<void> {
  const consented = at(dayOffset(-58), 7, 30).toISOString();
  const { error: pErr } = await db
    .from("profiles")
    .update({
      display_name: "Demo Athlete",
      unit_system: "imperial",
      sex: "male",
      // 28 years old (fictional sample member).
      birth_year: Number(TODAY.slice(0, 4)) - 28,
      height_cm: 180,
      faith_enabled: true,
      timezone: TZ,
      onboarding_completed_at: consented,
      ai_data_consent_at: consented,
      wellness_consent_at: consented,
      coach_memory_enabled: true,
      coach_memory_consent_at: consented,
      // Agreed to meal and label photos, so the photo screens open straight away in the demo.
      food_photo_consent_at: consented,
      step_goal: 9000,
      sleep_goal_minutes: 450,
      sleep_target_wake: "06:30:00",
      sleep_import_enabled: true,
      sleep_import_source: "apple_health",
      sleep_import_connected_at: at(dayOffset(-16), 21, 0).toISOString(),
    })
    .eq("id", id);
  if (pErr) fail(`profile: ${pErr.message}`);
  await insert("onboarding_answers", {
    user_id: id,
    primary_goal: "build_strength",
    secondary_goal: "run_5k",
    experience: "intermediate",
    days_per_week: 4,
    session_minutes: 60,
    equipment: ["barbell", "dumbbell", "bench", "rack", "pull_up_bar", "cable", "machine"],
    diet_type: "high_protein",
    activity_level: "active",
    goal_weight_kg: 82,
    weekly_change_kg: -0.25,
  }, "user_id");
  await insert("nutrition_goals", { user_id: id, calories: 2600, protein_g: 185, carbs_g: 290, fat_g: 78 }, "user_id");
  // A server-held test entitlement: Pro All Access with no payment behind it (the demo bar switches it).
  const { error: eErr } = await db.from("user_entitlements").upsert({ user_id: id, plan: "pro", source: "admin", valid_until: null }, { onConflict: "user_id" });
  if (eErr) fail(`entitlement: ${eErr.message}`);
}

// ---------- Training: eight weeks of the Powerbuilding 4-Day program

const START_KG: Record<string, [number, number]> = {
  // slug: [load eight weeks ago in kg, gain per week]
  "bench-press": [82.5, 1.25],
  "barbell-row": [70, 1.25],
  "seated-dumbbell-shoulder-press": [22, 0.5],
  "lat-pulldown": [60, 1.25],
  "triceps-pushdown": [27.5, 0.6],
  "face-pull": [20, 0.6],
  "back-squat": [115, 2.5],
  "romanian-deadlift": [95, 2],
  "leg-press": [180, 5],
  "seated-leg-curl": [45, 1.25],
  "standing-calf-raise": [70, 2.5],
  "incline-dumbbell-press": [28, 0.6],
  "chest-supported-row": [26, 0.6],
  "cable-chest-fly": [15, 0.6],
  "lateral-raise": [9, 0.3],
  "incline-dumbbell-curl": [12, 0.3],
  "overhead-triceps-extension": [22.5, 0.6],
  "conventional-deadlift": [150, 2.5],
  "bulgarian-split-squat": [20, 0.6],
  "hip-thrust": [120, 3],
  "leg-extension": [50, 1.25],
  "seated-calf-raise": [40, 1.25],
};

interface DayPlan {
  id: string;
  dayNumber: number;
  name: string;
  exercises: { exerciseId: string; slug: string; sets: number; reps: string | null; seconds: number | null; bodyweight: boolean }[];
}

async function loadProgram(slug: string): Promise<{ programId: string; days: DayPlan[] }> {
  const { data: program, error } = await db.from("training_programs").select("id").eq("slug", slug).single();
  if (error || !program) fail(`program ${slug} not found`);
  const { data: week } = await db
    .from("program_weeks")
    .select("program_days(id, day_number, name, program_exercises(exercise_id, sets, reps, duration_seconds, position, exercises(slug, equipment)))")
    .eq("program_id", program.id)
    .eq("week_number", 1)
    .single();
  type Row = { id: string; day_number: number; name: string; program_exercises: { exercise_id: string; sets: number; reps: string | null; duration_seconds: number | null; position: number; exercises: { slug: string; equipment: string[] } }[] };
  const days = ((week?.program_days ?? []) as unknown as Row[])
    .sort((a, b) => a.day_number - b.day_number)
    .map((d) => ({
      id: d.id,
      dayNumber: d.day_number,
      name: d.name,
      exercises: d.program_exercises
        .sort((a, b) => a.position - b.position)
        .map((e) => ({
          exerciseId: e.exercise_id,
          slug: e.exercises.slug,
          sets: e.sets,
          reps: e.reps,
          seconds: e.duration_seconds,
          bodyweight: e.exercises.equipment.every((q) => q === "bodyweight" || q === "pull_up_bar"),
        })),
    }));
  return { programId: program.id as string, days };
}

async function seedTraining(userId: string) {
  const { programId, days } = await loadProgram("powerbuilding-4-day");
  const [up] = await insert("user_programs", {
    user_id: userId,
    program_id: programId,
    status: "active",
    current_week: 3,
    current_day: 1,
    started_at: at(dayOffset(-15), 6, 0).toISOString(),
  });
  const foundations = await idsBySlug("training_programs", ["dumbbell-home-strength", "5k-training"]);
  await insert("user_programs", [...foundations.values()].map((program_id) => ({ user_id: userId, program_id, status: "saved" })));

  // Mon/Tue/Thu/Sat, eight weeks back, a few missed days so consistency looks real.
  const skip = new Set(["7-3", "4-1", "2-4"]);
  const best = new Map<string, { exerciseId: string; e1rm: number; weight: number; reps: number; sessionId: string; at: string }>();
  let sessions = 0;
  for (let week = 8; week >= 1; week--) {
    const progress = 8 - week;
    for (const [i, offset] of [0, 1, 3, 5].entries()) {
      const day = days[i]!;
      if (skip.has(`${week}-${day.dayNumber}`)) continue;
      // The Monday `week` weeks ago, plus the day's offset.
      const date = dayOffset(-(isoDow(TODAY) - 1) - week * 7 + offset);
      if (date >= TODAY) continue;
      const started = at(date, 6, 5 + ((week * 7 + i) % 20));
      const minutes = 58 + ((week + i) % 4) * 6;
      const inProgram = week <= 2;
      let volume = 0;
      const [session] = await insert("workout_sessions", {
        user_id: userId,
        client_id: randomUUID(),
        user_program_id: inProgram ? up!.id : null,
        program_day_id: inProgram ? day.id : null,
        name: day.name,
        status: "completed",
        started_at: started.toISOString(),
        ended_at: plus(started, minutes).toISOString(),
        notes: week === 1 && i === 0 ? "Bench moved fast today." : null,
      });
      sessions++;
      for (const [position, ex] of day.exercises.entries()) {
        const [we] = await insert("workout_exercises", { session_id: session!.id, user_id: userId, exercise_id: ex.exerciseId, position });
        const reps = topReps(ex.reps) - (progress < 3 ? 1 : 0);
        const [base, gain] = START_KG[ex.slug] ?? [20, 0.5];
        const weight = ex.bodyweight ? null : round(base + gain * progress, ex.slug.includes("dumbbell") || base < 30 ? 1 : 2.5);
        const sets = Array.from({ length: ex.sets }, (_, s) => ({
          workout_exercise_id: we!.id,
          user_id: userId,
          set_number: s + 1,
          reps: ex.seconds ? null : Math.max(1, reps - (s === ex.sets - 1 && (week + s) % 3 === 0 ? 1 : 0)),
          duration_seconds: ex.seconds,
          weight_kg: weight,
          rpe: s === ex.sets - 1 ? 8 : 7,
          completed: true,
          is_warmup: false,
        }));
        await insert("workout_sets", sets);
        for (const set of sets) {
          if (set.weight_kg && set.reps) {
            volume += set.weight_kg * set.reps;
            const e1rm = Math.round(set.weight_kg * (1 + set.reps / 30) * 10) / 10;
            const prev = best.get(ex.slug);
            if (!prev || e1rm > prev.e1rm) best.set(ex.slug, { exerciseId: ex.exerciseId, e1rm, weight: set.weight_kg, reps: set.reps, sessionId: session!.id, at: plus(started, minutes).toISOString() });
          }
        }
      }
      const { error } = await db.from("workout_sessions").update({ total_volume_kg: Math.round(volume) }).eq("id", session!.id);
      if (error) fail(`session volume: ${error.message}`);
    }
  }
  const prs = ["bench-press", "back-squat", "conventional-deadlift", "barbell-row", "romanian-deadlift", "hip-thrust"].flatMap((slug) => {
    const b = best.get(slug);
    if (!b) return [];
    return [
      { user_id: userId, exercise_id: b.exerciseId, record_type: "estimated_1rm", value: b.e1rm, weight_kg: b.weight, reps: b.reps, session_id: b.sessionId, achieved_at: b.at },
      { user_id: userId, exercise_id: b.exerciseId, record_type: "max_weight", value: b.weight, weight_kg: b.weight, reps: b.reps, session_id: b.sessionId, achieved_at: b.at },
    ];
  });
  await insert("personal_records", prs);

  const lifts = await idsBySlug("exercises", ["bench-press", "conventional-deadlift"]);
  await insert("fitness_goals", [
    { user_id: userId, title: "Bench press 265 lb", goal_type: "strength", exercise_id: lifts.get("bench-press"), start_value: 100, target_value: 120, unit: "kg", target_date: dayOffset(120), status: "active" },
    { user_id: userId, title: "Deadlift 405 lb", goal_type: "strength", exercise_id: lifts.get("conventional-deadlift"), start_value: 160, target_value: 184, unit: "kg", target_date: dayOffset(240), status: "active" },
    { user_id: userId, title: "Reach 181 lb", goal_type: "bodyweight", start_value: 86.2, target_value: 82, unit: "kg", target_date: dayOffset(90), status: "active" },
    { user_id: userId, title: "Train 4 days a week", goal_type: "frequency", target_value: 4, unit: "sessions", status: "active" },
  ]);

  // Bodyweight, measurements and the morning recovery check-ins.
  await insert(
    "weight_entries",
    Array.from({ length: 20 }, (_, i) => ({ user_id: userId, recorded_on: dayOffset(-57 + i * 3), weight_kg: Number((86.4 - i * 0.16 + ((i * 7) % 5) * 0.08).toFixed(1)) })),
  );
  await insert("measurement_entries", [
    { user_id: userId, recorded_on: dayOffset(-56), waist_cm: 89, chest_cm: 106, arm_cm: 38, thigh_cm: 60, body_fat_pct: 19, notes: SAMPLE },
    { user_id: userId, recorded_on: dayOffset(-28), waist_cm: 87.5, chest_cm: 106.5, arm_cm: 38.5, thigh_cm: 60.5, body_fat_pct: 18 },
    { user_id: userId, recorded_on: dayOffset(-2), waist_cm: 86, chest_cm: 107, arm_cm: 39, thigh_cm: 61, body_fat_pct: 17 },
  ]);
  await insert(
    "recovery_checkins",
    Array.from({ length: 10 }, (_, i) => {
      const sleep = 3 + ((i * 2) % 3) - (i === 4 ? 1 : 0);
      const energy = 3 + ((i + 1) % 3);
      const soreness = 2 + (i % 3);
      const stress = 2 + ((i * 3) % 3);
      return {
        user_id: userId,
        checked_on: dayOffset(-(i + 1)),
        sleep_quality: sleep,
        energy,
        soreness,
        stress,
        readiness_score: Math.round(((sleep + energy + (6 - soreness) + (6 - stress)) / 20) * 100),
      };
    }),
    "user_id",
  );
  return sessions;
}

// ---------- Food: two weeks of meals from the app's food database

const FOODS = [
  "Oats, rolled, dry",
  "Blueberries",
  "Whey protein powder",
  "Egg, large, whole",
  "Banana",
  "Greek yogurt, plain, nonfat",
  "Chicken breast, skinless, cooked",
  "White rice, cooked",
  "Broccoli, cooked",
  "Salmon, Atlantic, cooked",
  "Sweet potato, baked",
  "Spinach, raw",
  "Olive oil",
  "Turkey sandwich on wheat",
  "Apple",
  "Almonds",
  "Ground beef 90% lean, cooked",
  "Quinoa, cooked",
  "Peanut butter",
  "Milk, 2%",
  "Cottage cheese, 2%",
];
type MealPlan = [string, string, number][]; // meal type, food name, servings
const MENUS: MealPlan[] = [
  [["breakfast", "Oats, rolled, dry", 1], ["breakfast", "Blueberries", 1], ["breakfast", "Whey protein powder", 1], ["lunch", "Chicken breast, skinless, cooked", 1.5], ["lunch", "White rice, cooked", 1.5], ["lunch", "Broccoli, cooked", 1], ["snack", "Greek yogurt, plain, nonfat", 1], ["snack", "Banana", 1], ["dinner", "Salmon, Atlantic, cooked", 1.5], ["dinner", "Sweet potato, baked", 1.5], ["dinner", "Spinach, raw", 1], ["dinner", "Olive oil", 1]],
  [["breakfast", "Egg, large, whole", 3], ["breakfast", "Milk, 2%", 1], ["breakfast", "Banana", 1], ["lunch", "Turkey sandwich on wheat", 1], ["lunch", "Apple", 1], ["snack", "Almonds", 1], ["snack", "Whey protein powder", 1], ["dinner", "Ground beef 90% lean, cooked", 1.5], ["dinner", "Quinoa, cooked", 1.5], ["dinner", "Broccoli, cooked", 1]],
  [["breakfast", "Greek yogurt, plain, nonfat", 1], ["breakfast", "Oats, rolled, dry", 1], ["breakfast", "Peanut butter", 1], ["lunch", "Chicken breast, skinless, cooked", 1.5], ["lunch", "Quinoa, cooked", 1], ["lunch", "Spinach, raw", 1], ["snack", "Cottage cheese, 2%", 1], ["snack", "Apple", 1], ["dinner", "Salmon, Atlantic, cooked", 1.5], ["dinner", "White rice, cooked", 1.5], ["dinner", "Broccoli, cooked", 1]],
];

async function seedFood(userId: string) {
  const { data: foods, error } = await db.from("foods").select("*").is("owner_id", null).in("name", FOODS);
  if (error) fail(`foods: ${error.message}`);
  const byName = new Map((foods ?? []).map((f) => [f.name as string, f]));
  const missing = FOODS.filter((n) => !byName.has(n));
  if (missing.length) fail(`foods not found: ${missing.join(", ")}`);
  for (let d = -29; d <= 0; d++) {
    const date = dayOffset(d);
    const menu = MENUS[(((d + 30) % MENUS.length) + MENUS.length) % MENUS.length]!.filter(([meal]) => d < 0 || meal !== "dinner"); // today: dinner not eaten yet
    const mealIds = new Map<string, string>();
    for (const [meal, name, servings] of menu) {
      if (!mealIds.has(meal)) {
        const [m] = await insert("meals", { user_id: userId, eaten_on: date, meal_type: meal, status: "logged" });
        mealIds.set(meal, m!.id);
      }
      const food = byName.get(name)!;
      const basis = basisFromFoodRow(food as Parameters<typeof basisFromFoodRow>[0]);
      // The same choice the app makes for a food picked by servings.
      const unit = basisUnits(basis).some((u) => u.id === "serving") ? "serving" : "g";
      const r = computeAmount(basis, unit === "g" ? servings * Number(food.serving_size) : servings, unit);
      if (!r) fail(`no amount for ${name}`);
      const n = r.nutrition;
      await insert("meal_items", {
        meal_id: mealIds.get(meal),
        user_id: userId,
        food_id: food.id,
        name,
        servings,
        is_estimate: false,
        calories: n.calories,
        protein_g: n.protein_g,
        carbs_g: n.carbs_g,
        fat_g: n.fat_g,
        fiber_g: n.fiber_g,
        sugar_g: n.sugar_g,
        sodium_mg: n.sodium_mg,
        grams: r.grams,
        quantity: servings,
        unit_label: r.unit.label.slice(0, 100),
        amount_label: r.amountLabel.slice(0, 160),
        source: `food:${food.id as string}`,
        basis,
      });
    }
    // Tonight's dinner, planned ahead.
    if (d === 0) {
      const [m] = await insert("meals", { user_id: userId, eaten_on: date, meal_type: "dinner", status: "planned", notes: "Planned" });
      const salmon = byName.get("Salmon, Atlantic, cooked")!;
      await insert("meal_items", { meal_id: m!.id, user_id: userId, food_id: salmon.id, name: salmon.name, servings: 1.5, calories: Number(salmon.calories) * 1.5, protein_g: Number(salmon.protein_g) * 1.5, carbs_g: 0, fat_g: Number(salmon.fat_g) * 1.5, source: `food:${salmon.id as string}` });
    }
    await insert("water_entries", [500, 750, 500, 600, ...(d < 0 ? [500] : [])].map((amount_ml) => ({ user_id: userId, recorded_on: date, amount_ml })));
    await insert("daily_steps", { user_id: userId, day: date, steps: d === 0 ? 4120 : 7200 + ((d * 1931) % 5200) + (isoDow(date) >= 6 ? 2500 : 0), source: "manual" }, "user_id");
  }
}

// ---------- Runs: hand-logged runs plus GPS runs on clearly labelled sample routes

/** A loop route around a park as recorded points (lng, lat), with per-mile splits. */
function sampleRoute(distanceM: number, movingS: number, startLat: number, startLng: number) {
  const loopM = 1600;
  const points: [number, number][] = [];
  const steps = Math.max(40, Math.round(distanceM / 25));
  for (let i = 0; i <= steps; i++) {
    const along = (distanceM * i) / steps;
    const a = ((along % loopM) / loopM) * 2 * Math.PI;
    const north = (loopM / (2 * Math.PI)) * Math.sin(a) * 1.35;
    const east = (loopM / (2 * Math.PI)) * (1 - Math.cos(a)) * 0.75;
    points.push([Number((startLng + east / (111_195 * Math.cos((startLat * Math.PI) / 180))).toFixed(5)), Number((startLat + north / 111_195).toFixed(5))]);
  }
  const mile = 1609.344;
  const splits = [];
  let covered = 0;
  for (let index = 1; covered < distanceM - 1; index++) {
    const d = Math.min(mile, distanceM - covered);
    const s = Math.round((movingS * d) / distanceM * (1 + ((index % 3) - 1) * 0.02));
    splits.push({ index, unit: "mi", distance_m: Math.round(d), moving_s: s, elapsed_s: s + (index === 2 ? 12 : 0), split_s: s });
    covered += d;
  }
  return { route: { type: "MultiLineString", coordinates: [points] }, splits };
}

async function seedRuns(userId: string) {
  const runs: { days: number; kind: "run" | "walk"; gps: boolean; m: number; s: number; effort: number }[] = [
    { days: -40, kind: "run", gps: false, m: 4000, s: 1440, effort: 6 },
    { days: -33, kind: "run", gps: false, m: 5000, s: 1790, effort: 7 },
    { days: -26, kind: "run", gps: false, m: 5000, s: 1730, effort: 6 },
    { days: -19, kind: "walk", gps: false, m: 3200, s: 2280, effort: 3 },
    { days: -12, kind: "run", gps: true, m: 5200, s: 1760, effort: 6 },
    { days: -9, kind: "walk", gps: true, m: 3600, s: 2520, effort: 2 },
    { days: -5, kind: "run", gps: true, m: 6400, s: 2160, effort: 7 },
    { days: -2, kind: "run", gps: true, m: 5000, s: 1625, effort: 8 },
  ];
  await insert(
    "activities",
    runs.map((r, i) => {
      const started = at(dayOffset(r.days), 18, 10 + i);
      const base = { user_id: userId, kind: r.kind, started_at: started.toISOString(), timezone: TZ, distance_m: r.m, elapsed_s: r.s + 45, moving_s: r.s, perceived_effort: r.effort };
      if (!r.gps) return { ...base, source: "manual", notes: null };
      const { route, splits } = sampleRoute(r.m, r.s, 40.7812, -73.9665);
      return {
        ...base,
        source: "gps",
        route,
        splits,
        gps_quality: { gaps: 0, rejected: 3, lastAccuracy: 5 },
        notes: "Sample route for the demo, not a real recording.",
      };
    }),
  );
  await insert("running_goals", [
    { user_id: userId, kind: "weekly_distance", distance_m: 16093 },
    { user_id: userId, kind: "race_time", distance_m: 5000, target_s: 1500 },
  ]);
}

// ---------- Sleep: a month of nights, the last fortnight as if imported from a watch (sample data)

async function seedSleep(userId: string) {
  const device = "Apple Watch (sample data)";
  for (let i = 1; i <= 30; i++) {
    if (i === 5 || i === 22) continue; // unlogged nights show as gaps
    const night = dayOffset(-(i - 1));
    const weekend = isoDow(night) >= 6;
    const bed = at(dayOffset(-i), weekend ? 23 : 22, (i * 17) % 50);
    const wake = at(night, weekend ? 7 : 6, (i * 13) % 40);
    const id = randomUUID();
    const imported = i <= 16 && i !== 9 && i !== 14;
    if (!imported) {
      await insert("sleep_sessions", {
        id,
        user_id: userId,
        kind: "night",
        started_at: bed.toISOString(),
        ended_at: wake.toISOString(),
        onset_at: i % 3 === 0 ? plus(bed, 18).toISOString() : null,
        final_wake_at: i % 3 === 0 ? plus(wake, -8).toISOString() : null,
        awakenings: i % 3 === 0 ? 2 : null,
        awake_minutes: i % 3 === 0 ? 15 : null,
        timezone: TZ,
        night_of: night,
        source: "manual",
        overlap_until: wake.toISOString(),
        notes: i === 9 ? "Watch was charging" : null,
      });
      continue;
    }
    const onset = plus(bed, 8 + ((i * 3) % 12));
    const finalWake = plus(wake, -(3 + ((i * 5) % 9)));
    await insert("sleep_sessions", {
      id,
      user_id: userId,
      kind: "night",
      started_at: bed.toISOString(),
      ended_at: wake.toISOString(),
      onset_at: onset.toISOString(),
      final_wake_at: finalWake.toISOString(),
      timezone: TZ,
      night_of: night,
      source: "apple_health",
      source_id: `demo-sample-${night}`,
      overlap_until: wake.toISOString(),
      device_name: device,
      hr_avg: 54 + ((i * 7) % 9),
      hr_min: 46 + ((i * 3) % 5),
      hr_max: 68 + ((i * 5) % 14),
      hr_samples: 380 + ((i * 11) % 90),
      hrv_avg_ms: 36 + ((i * 13) % 180) / 10,
      hrv_method: "sdnn",
      hrv_samples: 5 + (i % 4),
      rr_avg: 14 + ((i * 7) % 30) / 10,
      rr_min: 12.5 + (i % 3) / 2,
      rr_max: 16 + (i % 5) / 2,
      rr_samples: 90 + ((i * 3) % 40),
    });
    const stages = [];
    let t = onset;
    let awake = 0;
    let awakenings = 0;
    for (let k = 0; t < finalWake; k++) {
      const cycle = k % 6;
      const stage = ["light", "deep", "light", "rem", "light", "awake"][cycle]!;
      let len = [25 + ((i + k) % 10), 35 + ((i * 2 + k) % 25), 20 + ((k * 3) % 15), 18 + ((i + k * 2) % 22), 15 + (k % 10), 2 + ((i + k) % 5)][cycle]!;
      const left = Math.floor((finalWake.getTime() - t.getTime()) / 60_000);
      if (len > left) len = Math.max(1, left);
      if (stage === "awake") {
        awake += len;
        awakenings++;
      }
      stages.push({ session_id: id, user_id: userId, stage, started_at: t.toISOString(), ended_at: plus(t, len).toISOString() });
      t = plus(t, len);
    }
    await insert("sleep_stages", stages);
    const { error } = await db.from("sleep_sessions").update({ awakenings, awake_minutes: awake }).eq("id", id);
    if (error) fail(`sleep totals: ${error.message}`);
  }
  await insert("sleep_import_runs", {
    user_id: userId,
    source: "apple_health",
    range_start: at(dayOffset(-14), 0).toISOString(),
    range_end: new Date().toISOString(),
    added: 1,
    duplicates: 12,
    conflicts: 0,
    updated: 0,
    with_vitals: 1,
    device,
  });
  const nap = at(dayOffset(-3), 14, 10);
  await insert("sleep_sessions", { id: randomUUID(), user_id: userId, kind: "nap", started_at: nap.toISOString(), ended_at: plus(nap, 25).toISOString(), timezone: TZ, night_of: dayOffset(-3), source: "manual", overlap_until: plus(nap, 25).toISOString() });
  await insert(
    "sleep_checkins",
    Array.from({ length: 10 }, (_, j) => {
      const i = j + 2;
      return {
        user_id: userId,
        day: dayOffset(-(i - 1)),
        restedness: 2 + (i % 4),
        energy_morning: 2 + (i % 3),
        energy_afternoon: 3 + (i % 2),
        energy_evening: 2 + ((i + 1) % 3),
        mood: 3 + (i % 3),
        stress: 1 + (i % 4),
        sleep_quality: 2 + ((i + 2) % 4),
        caffeine_last: i % 2 === 0 ? "15:30" : "10:00",
        alcohol: i % 4 === 0,
        late_meal: i % 5 === 0,
        exercise_timing: ["none", "morning", "afternoon", "evening"][i % 4],
        evening_screens: i % 3 === 0,
        disturbances: i % 4 === 1 ? ["noise"] : i % 4 === 2 ? ["heat", "worry"] : [],
        travel: false,
      };
    }),
    "user_id",
  );
}

// ---------- Faith & Discipline (free for every member)

async function seedFaith(userId: string) {
  await insert("faith_journal_entries", [
    { user_id: userId, entry_date: dayOffset(-1), kind: "reflection", theme: "discipline", scripture_ref: "1 Corinthians 9:27", title: "Showing up when it's hard", body: "Didn't want to train this morning. Went anyway and the squats felt strong. Discipline first, then the motivation follows." },
    { user_id: userId, entry_date: dayOffset(-4), kind: "praise", theme: "gratitude", scripture_ref: "Psalm 28:7", title: "New bench PR", body: "Thankful for a healthy body and a new best on bench." },
    { user_id: userId, entry_date: dayOffset(-8), kind: "request", theme: "perseverance", title: "Patience with the process", body: "Pray for patience. Progress is slower than I want, but it's steady." },
    { user_id: userId, entry_date: dayOffset(-15), kind: "reflection", theme: "stewardship", scripture_ref: "1 Corinthians 6:19-20", title: "Taking care of the temple", body: "Cooking more at home this week. Treating food as fuel, not a reward." },
    { user_id: userId, entry_date: dayOffset(-22), kind: "reflection", theme: "self_control", title: "Evenings off screens", body: "Phone away by 10 pm three nights this week. Sleeping better." },
  ]);
  const [enrollment] = await insert("challenge_enrollments", { user_id: userId, challenge_slug: "narrow-gate-40", started_on: dayOffset(-12), status: "active" });
  await insert(
    "challenge_checkins",
    Array.from({ length: 12 }, (_, i) => i + 1)
      .filter((d) => d !== 7)
      .map((day_number) => ({
        enrollment_id: enrollment!.id,
        user_id: userId,
        day_number,
        checked_on: dayOffset(-12 + day_number - 1),
        devotional_done: true,
        workout_done: day_number % 5 !== 0, // a couple of days with the reading but not the training
        note: day_number === 3 ? "Hard week at work, but I kept the morning reading." : null,
      })),
    "enrollment_id",
  );
  const goals = await insert("discipline_goals", [
    { user_id: userId, title: "Read Scripture each morning", practice: "scripture", cadence: "daily" },
    { user_id: userId, title: "Pray before training", practice: "prayer", cadence: "daily" },
    { user_id: userId, title: "Write three things I'm grateful for", practice: "gratitude", cadence: "weekly" },
  ]);
  const checkins = [];
  for (let d = -13; d <= -1; d++) {
    if (d % 4 !== 0) checkins.push({ goal_id: goals[0]!.id, user_id: userId, checked_on: dayOffset(d) });
    if (d % 3 !== 0) checkins.push({ goal_id: goals[1]!.id, user_id: userId, checked_on: dayOffset(d) });
  }
  checkins.push({ goal_id: goals[2]!.id, user_id: userId, checked_on: dayOffset(-8) }, { goal_id: goals[2]!.id, user_id: userId, checked_on: dayOffset(-1) });
  await insert("discipline_checkins", checkins, "goal_id");
}

// ---------- Bible, reading journey, prayer, memory verses and studies (all free)

/** Local time on a given date in the demo time zone, as an ISO string. */
const localIso = (date: string, hour: number, minute = 0) => at(date, hour, minute).toISOString();

async function seedDiscipleship(userId: string): Promise<string> {
  // A 90-day Gospels journey started 20 days ago, kept every day so far: reading in the morning, prayer in the
  // evening. Recorded through the database's own rule (faith_journey_check_in_at / faith_journey_settle_at), so the
  // journey's day, attempts and history are exactly what the app itself would have produced. Today is left open, so
  // the presenter can mark today's reading and prayer live.
  const startOn = dayOffset(-20);
  const [journey] = await insert("faith_journeys", { user_id: userId, plan_kind: "gospels", duration_days: 90, start_on: startOn });
  await insert("faith_journey_attempts", { journey_id: journey!.id, user_id: userId, attempt_number: 1, started_on: startOn });
  const { journeyPlan, validPlanSpec } = await import("@/server/bible/plans");
  const plan = journeyPlan(validPlanSpec("gospels", null)!, 90);
  if (!plan) fail("the Gospels plan couldn't be built");
  const history: Record<string, unknown>[] = [];
  for (let d = -20; d <= -1; d++) {
    const date = dayOffset(d);
    for (const [activity, hour] of [["reading", 6], ["prayer", 21]] as const) {
      const { error } = await db.rpc("faith_journey_check_in_at", { p_user: userId, p_activity: activity, p_now: localIso(date, hour, 40) });
      if (error) fail(`journey check-in ${date} ${activity}: ${error.message}`);
    }
    // The chapters that day's reading covered, in the reading history.
    const day = plan.schedule[d + 20]!;
    const chapters = new Set<string>();
    for (const r of day.refs) for (let c = r.chapter; c <= (r.chapterEnd ?? r.chapter); c++) chapters.add(`${r.bookId}|${c}`);
    for (const key of chapters) {
      const [book_id, chapter] = key.split("|");
      history.push({ user_id: userId, book_id, chapter: Number(chapter), read_on: date, read_at: localIso(date, 6, 30) });
    }
  }
  const { error: settleErr } = await db.rpc("faith_journey_settle_at", { p_journey_id: journey!.id, p_now: new Date().toISOString() });
  if (settleErr) fail(`journey settle: ${settleErr.message}`);
  await insert("bible_reading_history", history, "id");
  const next = plan.schedule[20]!.refs[0]!;
  await insert("bible_reading_state", { user_id: userId, book_id: next.bookId, chapter: next.chapter, verse: next.verseStart ?? null }, "user_id");

  // Highlights, bookmarks and notes the member made while reading.
  await insert(
    "bible_highlights",
    [
      ["MAT", 7, 13, "gold"],
      ["MAT", 7, 14, "gold"],
      ["JHN", 3, 16, "gold"],
      ["PHP", 4, 13, "sage"],
      ["ISA", 40, 31, "sky"],
      ["1CO", 9, 27, "rose"],
      ["PSA", 23, 1, "sage"],
    ].map(([book_id, chapter, verse, color]) => ({ user_id: userId, book_id, chapter, verse, color })),
    "user_id",
  );
  await insert("bible_bookmarks", [
    { user_id: userId, book_id: "MAT", chapter: 7, verse: 13, label: "The narrow gate" },
    { user_id: userId, book_id: "PSA", chapter: 23, verse: null, label: "Psalm 23" },
  ]);
  await insert("bible_notes", [
    { user_id: userId, book_id: "MAT", chapter: 7, verse_start: 13, verse_end: 14, body: "The narrow way is a daily choice, in small things: getting up to train, opening the Bible before the phone." },
    { user_id: userId, book_id: "1CO", chapter: 9, verse_start: 24, verse_end: 27, body: "Paul uses the athlete's discipline as a picture of the Christian life. Train with purpose, not aimlessly." },
  ]);

  // Memory verses: one learnt, one in progress (due for review today).
  await insert("scripture_memory", [
    { user_id: userId, book_id: "JOS", chapter: 1, verse_start: 9, verse_end: 9, status: "memorized", level: 4, review_count: 9, next_review_on: dayOffset(12), last_reviewed_at: localIso(dayOffset(-2), 7) },
    { user_id: userId, book_id: "PHP", chapter: 4, verse_start: 13, verse_end: 13, status: "learning", level: 2, review_count: 4, next_review_on: TODAY, last_reviewed_at: localIso(dayOffset(-3), 7) },
  ]);

  // Prayer journal: an answered request, an open one for a friend, and recent daily prayers.
  await insert("faith_journal_entries", [
    { user_id: userId, entry_date: dayOffset(-26), kind: "request", theme: "perseverance", title: "A new job", body: "Pray for wisdom and peace about the job interview next week.", answered_on: dayOffset(-17), answered_note: "Got the offer, and the hours leave room to train in the mornings." },
    { user_id: userId, entry_date: dayOffset(-6), kind: "intercession", theme: "other", title: "My brother's recovery", body: "Pray for healing after his knee surgery, and patience through the rehab." },
    ...[-3, -2, -1].map((d) => ({ user_id: userId, entry_date: dayOffset(d), kind: "daily", theme: "gratitude", title: "Morning prayer", body: "Thank You for strength for today. Help me to be faithful in small things." })),
  ]);

  // Daily Faith & Fitness goals over the last ten days.
  const goals: Record<string, unknown>[] = [];
  for (let d = -10; d <= -1; d++) {
    const date = dayOffset(d);
    goals.push({ user_id: userId, goal_date: date, kind: "faith_challenge", completed_at: localIso(date, 20) });
    if (d % 4 !== 0) goals.push({ user_id: userId, goal_date: date, kind: "fitness", completed_at: localIso(date, 19) });
  }
  await insert("faith_daily_goals", goals, "user_id");

  // A guided study under way: the member's own notes (the study's commentary stays unpublished until reviewed).
  await insert("bible_study_progress", { user_id: userId, study_slug: "gospel", lesson_slug: "good-news", completed_at: localIso(dayOffset(-5), 7), notes: "Jesus' first message: repent and believe. Both, every day." }, "user_id");
  return `Gospels journey on day 21 of 90 (20 days kept), ${history.length} chapters read, highlights, notes, memory verses, prayer journal`;
}

/** Reminders the member turned on (shown on Profile → Notifications and its 24-hour preview; delivery needs the phone app). */
async function seedReminders(userId: string) {
  const weekdays = [1, 2, 4, 6]; // training days (JavaScript weekdays: 0 = Sunday)
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const { error: fErr } = await db.from("faith_reminders").upsert(
    [
      { user_id: userId, kind: "reading", enabled: true, remind_at: "06:15", weekdays: everyDay },
      { user_id: userId, kind: "prayer", enabled: true, remind_at: "21:00", weekdays: everyDay },
      { user_id: userId, kind: "final", enabled: true, remind_at: "22:30", weekdays: everyDay },
    ],
    { onConflict: "user_id,kind", defaultToNull: false },
  );
  if (fErr) fail(`faith reminders: ${fErr.message}`);
  const { error: nErr } = await db.from("notification_reminders").upsert(
    [
      { user_id: userId, kind: "workout", enabled: true, remind_at: "05:45", weekdays, style: "faith" },
      { user_id: userId, kind: "lunch", enabled: true, remind_at: "12:30", weekdays: everyDay },
      { user_id: userId, kind: "water", enabled: true, remind_at: "08:00", weekdays: everyDay, interval_minutes: 120, end_at: "20:00" },
      { user_id: userId, kind: "winddown", enabled: true, remind_at: "21:45", weekdays: everyDay },
    ],
    { onConflict: "user_id,kind", defaultToNull: false },
  );
  if (nErr) fail(`reminders: ${nErr.message}`);
  const { error: pErr } = await db.from("notification_prefs").upsert({ user_id: userId, quiet_start: "22:45", quiet_end: "05:30", daily_limit: 8 }, { onConflict: "user_id" });
  if (pErr) fail(`notification settings: ${pErr.message}`);
}


/** The client every seeder writes with (the service role). */
export function setSeedClient(client: SupabaseClient): void {
  db = client;
}

/** Everything the sample member has done: returns the two summary lines the seed script prints. */
export async function seedSampleData(userId: string): Promise<{ sessions: number; discipleship: string }> {
  const sessions = await seedTraining(userId);
  await seedFood(userId);
  await seedRuns(userId);
  await seedSleep(userId);
  await seedFaith(userId);
  const discipleship = await seedDiscipleship(userId);
  await seedReminders(userId);
  return { sessions, discipleship };
}

/**
 * Reset demo: every row and file of this one account goes, then the profile and the sample history come back. The
 * auth user itself stays (so the member stays signed in, and the sign-in password is unchanged). Only ever called for
 * the sample account on a demo server (the action checks); the account id scopes every delete.
 */
export async function resetSampleAccount(client: SupabaseClient, userId: string): Promise<void> {
  setSeedClient(client);
  for (const { table, column, orColumn } of USER_TABLES) {
    if (table === "profiles") continue; // kept (and rewritten by seedSampleProfile): other rows reference it
    const del = client.from(table).delete();
    const { error } = await (orColumn ? del.or(`${column}.eq.${userId},${orColumn}.eq.${userId}`) : del.eq(column, userId));
    if (error) fail(`${table}: ${error.message}`);
  }
  await removeUserStorage(client, userId);
  await seedSampleProfile(userId);
  await seedSampleData(userId);
}
