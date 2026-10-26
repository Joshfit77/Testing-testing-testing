/**
 * Seeds the interactive demo: one sample member with about two months of realistic, entirely made-up history
 * (workouts, food, runs with sample routes, sleep, faith, goals), then writes the account's sign-in to a local file
 * that is never committed (.demo-credentials.local).
 *
 *   npx tsx scripts/demo/seed-demo.ts            (normally run by scripts/demo/run-demo.sh)
 *   npx tsx scripts/demo/seed-demo.ts --check-only   (only the safety checks below; changes nothing)
 *
 * Safety:
 * - It only writes to the Supabase project in NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
 * - It refuses any project that isn't on this computer unless DEMO_SEED_ALLOW_REMOTE=true (a project made only for
 *   the demo), and it refuses any project that has an account not created by the demo, so it can never touch real
 *   members' data.
 * - Every account it creates carries app_metadata.demo = true, set with the service role (members can't set it).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { basisFromFoodRow, basisUnits, computeAmount } from "@/lib/domain/food-basis";
import { signupAcceptances } from "@/lib/legal/versions";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL = process.env.DEMO_ACCOUNT_EMAIL || "sample-member@demo.narrowgatefitness.invalid";
const TZ = "America/New_York";
const CREDENTIALS_FILE = process.env.DEMO_CREDENTIALS_FILE || ".demo-credentials.local";
const SAMPLE = "Sample data for the demo";

function fail(message: string): never {
  console.error(`seed-demo: ${message}`);
  process.exit(1);
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

// ---------- Safety checks

async function checkTarget() {
  if (!URL || !SERVICE_KEY) fail("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.local).");
  const host = new globalThis.URL(URL).hostname;
  const local = host === "127.0.0.1" || host === "localhost";
  if (!local && process.env.DEMO_SEED_ALLOW_REMOTE !== "true") {
    fail(`${host} isn't on this computer. Only seed a Supabase project made just for the demo, and then set DEMO_SEED_ALLOW_REMOTE=true.`);
  }
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listing accounts: ${error.message}`);
    const others = data.users.filter((u) => u.app_metadata?.demo !== true);
    if (others.length) {
      fail(`this project has ${others.length}+ account(s) that the demo didn't create. The demo must use its own empty project; nothing was changed.`);
    }
    if (data.users.length < 200) break;
  }
}

async function removeDemoAccounts() {
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) fail(`listing accounts: ${error.message}`);
    const demo = data.users.filter((u) => u.app_metadata?.demo === true);
    if (!demo.length) return;
    for (const u of demo) {
      const { error: delErr } = await db.auth.admin.deleteUser(u.id);
      if (delErr) fail(`removing earlier demo account: ${delErr.message}`);
    }
  }
}

// ---------- The sample member

async function createMember(password: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    app_metadata: { demo: true },
    user_metadata: { display_name: "Jordan", legal_acceptances: signupAcceptances() },
  });
  if (error || !data.user) fail(`creating the demo account: ${error?.message}`);
  const id = data.user.id;
  const consented = at(dayOffset(-58), 7, 30).toISOString();
  const { error: pErr } = await db
    .from("profiles")
    .update({
      display_name: "Jordan",
      unit_system: "imperial",
      sex: "male",
      birth_year: 1991,
      height_cm: 180,
      faith_enabled: true,
      timezone: TZ,
      onboarding_completed_at: consented,
      ai_data_consent_at: consented,
      wellness_consent_at: consented,
      coach_memory_enabled: true,
      coach_memory_consent_at: consented,
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
  return id;
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
  const foundations = await idsBySlug("training_programs", ["foundations-full-body", "5k-training"]);
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
  for (let d = -13; d <= 0; d++) {
    const date = dayOffset(d);
    const menu = MENUS[(d + 14) % MENUS.length]!.filter(([meal]) => d < 0 || meal !== "dinner"); // today: dinner not eaten yet
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

async function main() {
  db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await checkTarget();
  if (process.argv.includes("--check-only")) {
    console.log("seed-demo: the target holds no accounts except demo accounts.");
    return;
  }
  await removeDemoAccounts();
  // Re-seeding under a running demo server keeps its password (DEMO_ACCOUNT_PASSWORD); otherwise a new random one.
  const password = process.env.DEMO_ACCOUNT_PASSWORD || randomBytes(18).toString("base64url");
  const userId = await createMember(password);
  const sessions = await seedTraining(userId);
  await seedFood(userId);
  await seedRuns(userId);
  await seedSleep(userId);
  await seedFaith(userId);
  writeFileSync(
    CREDENTIALS_FILE,
    `# Demo sign-in for the sample account (local file, never commit it). Created ${new Date().toISOString()}\nDEMO_ACCOUNT_EMAIL=${EMAIL}\nDEMO_ACCOUNT_PASSWORD=${password}\n`,
    { mode: 0o600 },
  );
  console.log(`seed-demo: sample account ready (${sessions} workouts, 14 days of food, 8 runs, 28 nights of sleep, faith history).`);
  console.log(`seed-demo: sign-in written to ${CREDENTIALS_FILE}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
