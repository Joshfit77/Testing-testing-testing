/**
 * Compact, token-efficient athlete context for the AI coach.
 *
 * `AthleteSnapshot` is plain data loaded server-side with the user's own session (RLS); the
 * formatting here is pure so it can be unit-tested with fixtures. Nothing about other users is ever
 * part of a snapshot.
 */
import { addDays } from "@/lib/domain/dates";
import { dailyStreak, weeklyStreak } from "@/lib/domain/streak";
import { estimateOneRepMax } from "@/lib/domain/strength";
import { displayWeight, weightUnit } from "@/lib/domain/units";
import type { UnitSystem } from "@/lib/domain/types";
import { JOURNAL_KIND_LABELS, type SharedJournalEntry } from "@/lib/domain/journal";
import type { CoachMemory } from "./memory";

export interface SnapshotSet {
  reps: number | null;
  weightKg: number | null;
  seconds: number | null;
  rpe: number | null;
}

export interface SnapshotWorkoutExercise {
  slug: string;
  name: string;
  skipped: boolean;
  skipReason: string | null;
  /** Completed, non-warm-up sets only. */
  sets: SnapshotSet[];
}

export interface SnapshotWorkout {
  date: string;
  name: string;
  volumeKg: number;
  exercises: SnapshotWorkoutExercise[];
}

export interface SnapshotProgramExercise {
  slug: string;
  name: string;
  sets: number;
  reps: string | null;
  seconds: number | null;
  rpe: number | null;
  intensity: string | null;
}

export interface SnapshotProgramDay {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: SnapshotProgramExercise[];
}

export interface SnapshotProgram {
  name: string;
  /** curated | starter | ai | custom — only the user's own (non-curated) programs can be edited. */
  source: string;
  editable: boolean;
  week: number;
  durationWeeks: number;
  daysPerWeek: number;
  nextDay: number;
  weekFocus: string | null;
  isDeload: boolean;
  days: SnapshotProgramDay[];
}

export interface AthleteSnapshot {
  today: string;
  units: UnitSystem;
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  goal: string | null;
  experience: string | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  equipment: string[];
  preferredTypes: string[];
  dietType: string | null;
  /** Only present when the user consented to wellness data. */
  limitations: string | null;
  goalWeightKg: number | null;
  weeklyChangeKg: number | null;
  activity: string | null;
  budget: { maintenance: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; floored: boolean } | null;
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number; isEstimate: boolean } | null;
  todayIntake: { calories: number; protein: number; carbs: number; fat: number; items: number };
  /** Last 7 days of logged food (days with entries only). */
  nutritionWeek: { date: string; calories: number; protein: number }[];
  program: SnapshotProgram | null;
  /** Newest first. */
  workouts: SnapshotWorkout[];
  /** All completed session dates over the last ~120 days (for adherence and streaks). */
  sessionDates: string[];
  prs: { name: string; slug: string; e1rmKg: number; achievedOn: string }[];
  /** Oldest first. */
  weights: { date: string; kg: number }[];
  steps: { date: string; steps: number }[];
  stepGoal: number | null;
  supplements: string[];
  readiness: { score: number; date: string } | null;
  /** Logged sleep (Sleep & Recovery), when the athlete allowed it and logged any. */
  sleep?: { lastNight: { date: string; asleepMinutes: number; inBedOnly: boolean } | null; avg14: number | null; nights14: number; goalMinutes: number } | null;
  challenge: { name: string; day: number; completedDays: number; totalDays: number } | null;
  faithEnabled: boolean;
  /**
   * Prayer-journal entries the user explicitly chose to share with the coach ("Share with AI Coach",
   * off by default). Journals are otherwise never part of the context.
   */
  sharedJournal?: SharedJournalEntry[];
  /** Long-term coaching memory (Pro): only loaded while the athlete has memory switched on. */
  memory?: { enabled: boolean; wellnessConsent: boolean; items: CoachMemory[] };
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function fmtWeight(kg: number, units: UnitSystem, decimals = 1): string {
  return `${displayWeight(kg, units, decimals)} ${weightUnit(units)}`;
}

/** Best working set by estimated 1RM (falls back to heaviest, then most reps / longest). */
export function topSet(sets: SnapshotSet[]): (SnapshotSet & { e1rmKg: number | null }) | null {
  let best: (SnapshotSet & { e1rmKg: number | null }) | null = null;
  for (const s of sets) {
    const e1rm = s.weightKg && s.reps ? estimateOneRepMax(s.weightKg, s.reps) : null;
    const score = e1rm ?? (s.weightKg ?? 0) * 1000 + (s.reps ?? 0) + (s.seconds ?? 0) / 1000;
    const bestScore = best ? (best.e1rmKg ?? (best.weightKg ?? 0) * 1000 + (best.reps ?? 0) + (best.seconds ?? 0) / 1000) : -1;
    if (score > bestScore) best = { ...s, e1rmKg: e1rm };
  }
  return best;
}

export function describeSet(s: SnapshotSet, units: UnitSystem): string {
  if (s.seconds && !s.reps) return `${s.seconds}s${s.weightKg ? ` @ ${fmtWeight(s.weightKg, units)}` : ""}`;
  const load = s.weightKg ? fmtWeight(s.weightKg, units) : "BW";
  return `${load}×${s.reps ?? 0}${s.rpe ? ` @${s.rpe}` : ""}`;
}

export interface LiftTrend {
  slug: string;
  name: string;
  sessions: number;
  firstDate: string;
  lastDate: string;
  firstE1rmKg: number;
  lastE1rmKg: number;
  bestE1rmKg: number;
  changePct: number;
  /** Sessions since the best e1RM was set (0 = the latest session was the best). */
  sessionsSinceBest: number;
}

/** e1RM trend per exercise across the given workouts (needs 2+ sessions with an e1RM). */
export function liftTrends(workouts: SnapshotWorkout[]): LiftTrend[] {
  const series = new Map<string, { name: string; points: { date: string; e1rm: number }[] }>();
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.exercises) {
      if (e.skipped) continue;
      const top = topSet(e.sets);
      if (!top?.e1rmKg) continue;
      const s = series.get(e.slug) ?? { name: e.name, points: [] };
      s.points.push({ date: w.date, e1rm: top.e1rmKg });
      series.set(e.slug, s);
    }
  }
  const out: LiftTrend[] = [];
  for (const [slug, { name, points }] of series) {
    if (points.length < 2) continue;
    const first = points[0]!;
    const last = points[points.length - 1]!;
    let bestIdx = 0;
    points.forEach((p, i) => {
      if (p.e1rm > points[bestIdx]!.e1rm) bestIdx = i;
    });
    out.push({
      slug,
      name,
      sessions: points.length,
      firstDate: first.date,
      lastDate: last.date,
      firstE1rmKg: first.e1rm,
      lastE1rmKg: last.e1rm,
      bestE1rmKg: points[bestIdx]!.e1rm,
      changePct: round(((last.e1rm - first.e1rm) / first.e1rm) * 100, 1),
      sessionsSinceBest: points.length - 1 - bestIdx,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/** Weekly bodyweight change from the oldest to the newest entry in the last ~4 weeks (kg/week). */
export function bodyweightTrend(weights: { date: string; kg: number }[], today: string): { latestKg: number; changeKg: number; perWeekKg: number; days: number } | null {
  if (!weights.length) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]!;
  const windowStart = addDays(today, -28);
  const recent = sorted.filter((w) => w.date >= windowStart);
  const first = recent.length >= 2 ? recent[0]! : sorted.length >= 2 ? sorted[0]! : null;
  if (!first || first.date === latest.date) return { latestKg: latest.kg, changeKg: 0, perWeekKg: 0, days: 0 };
  const days = Math.max(1, Math.round((Date.parse(latest.date) - Date.parse(first.date)) / 86_400_000));
  const changeKg = latest.kg - first.kg;
  return { latestKg: latest.kg, changeKg: round(changeKg, 2), perWeekKg: round((changeKg / days) * 7, 2), days };
}

/** Sessions in the last 28 days vs. the planned days per week. */
export function adherence(sessionDates: string[], today: string, daysPerWeek: number | null) {
  const since = addDays(today, -27);
  const last28 = new Set(sessionDates.filter((d) => d >= since && d <= today)).size;
  const planned = daysPerWeek ? daysPerWeek * 4 : null;
  return {
    last28,
    planned,
    pct: planned ? Math.min(100, Math.round((last28 / planned) * 100)) : null,
    dayStreak: dailyStreak(sessionDates, today),
    weekStreak: weeklyStreak(sessionDates, today, 1),
    lastSession: [...sessionDates].sort().at(-1) ?? null,
  };
}

function describeProgramExercise(e: SnapshotProgramExercise): string {
  const dose = e.reps ? `${e.sets}×${e.reps}` : e.seconds ? `${e.sets}×${e.seconds}s` : `${e.sets} sets`;
  const effort = e.rpe ? ` @RPE ${e.rpe}` : e.intensity ? ` (${e.intensity})` : "";
  return `${e.name} [${e.slug}] ${dose}${effort}`;
}

const label = (v: string | null | undefined) => (v ? v.replace(/_/g, " ") : "not set");

/**
 * Build the compact context block. `maxWorkouts` keeps the token budget predictable (~1–2k tokens for
 * an active user).
 */
export function formatAthleteContext(s: AthleteSnapshot, opts: { maxWorkouts?: number } = {}): string {
  const u = s.units;
  const w = (kg: number) => fmtWeight(kg, u);
  const lines: string[] = [];
  lines.push(`Today: ${s.today}. Units: ${u === "imperial" ? "lb/in" : "kg/cm"}.`);

  // Profile & goal
  const profile = [
    s.age ? `age ${s.age}` : null,
    s.sex && s.sex !== "unspecified" ? s.sex : null,
    s.heightCm ? (u === "imperial" ? `${Math.floor(s.heightCm / 2.54 / 12)}'${Math.round((s.heightCm / 2.54) % 12)}"` : `${s.heightCm} cm`) : null,
    s.weights.length ? `bodyweight ${w(s.weights[s.weights.length - 1]!.kg)}` : null,
  ].filter(Boolean);
  lines.push(`Profile: ${profile.join(", ") || "not provided"}.`);
  const goalBits = [label(s.goal), `experience ${label(s.experience)}`];
  if (s.goalWeightKg) goalBits.push(`goal weight ${w(s.goalWeightKg)}`);
  if (s.weeklyChangeKg != null) goalBits.push(`chosen pace ${s.weeklyChangeKg > 0 ? "+" : ""}${fmtWeight(s.weeklyChangeKg, u, 2)}/week`);
  if (s.activity) goalBits.push(`daily activity ${label(s.activity)}`);
  lines.push(`Goal: ${goalBits.join(", ")}.`);
  if (s.daysPerWeek || s.sessionMinutes) lines.push(`Schedule: ${s.daysPerWeek ?? "?"} days/week, ~${s.sessionMinutes ?? "?"} min.`);
  lines.push(`Equipment: ${s.equipment.length ? s.equipment.map(label).join(", ") : "bodyweight only"}.${s.preferredTypes.length ? ` Likes: ${s.preferredTypes.map(label).join(", ")}.` : ""}`);
  if (s.limitations) lines.push(`Self-reported limitations (consented; don't diagnose): ${s.limitations}`);

  // Nutrition
  lines.push(`Diet type: ${label(s.dietType ?? "balanced")}.`);
  if (s.budget) {
    lines.push(
      `Calorie budget (app estimate): maintenance ${s.budget.maintenance} kcal, goal ${s.budget.calories} kcal${s.budget.floored ? " (raised to the safe floor)" : ""}, P${s.budget.protein_g}/C${s.budget.carbs_g}/F${s.budget.fat_g} g.`,
    );
  }
  if (s.targets) {
    lines.push(`Saved targets${s.targets.isEstimate ? " (estimate)" : " (set by user)"}: ${s.targets.calories} kcal, P${s.targets.protein_g}/C${s.targets.carbs_g}/F${s.targets.fat_g} g, water ${s.targets.water_ml} ml.`);
  }
  const t = s.todayIntake;
  lines.push(
    t.items
      ? `Today's food so far: ${t.calories} kcal, P${t.protein}/C${t.carbs}/F${t.fat} g (${t.items} items)${s.targets ? `, ${s.targets.calories - t.calories} kcal and ${Math.max(0, s.targets.protein_g - t.protein)} g protein left` : ""}.`
      : "Today's food: nothing logged yet.",
  );
  if (s.nutritionWeek.length) {
    const avgK = Math.round(s.nutritionWeek.reduce((a, d) => a + d.calories, 0) / s.nutritionWeek.length);
    const avgP = Math.round(s.nutritionWeek.reduce((a, d) => a + d.protein, 0) / s.nutritionWeek.length);
    lines.push(`Last 7 days food: ${s.nutritionWeek.length}/7 days logged, avg ${avgK} kcal, ${avgP} g protein.`);
  }

  // Bodyweight
  const bw = bodyweightTrend(s.weights, s.today);
  if (bw && bw.days > 0) {
    lines.push(`Bodyweight trend: ${w(bw.latestKg)} now, ${bw.changeKg >= 0 ? "+" : ""}${w(bw.changeKg)} over ${bw.days} days (${bw.perWeekKg >= 0 ? "+" : ""}${fmtWeight(bw.perWeekKg, u, 2)}/week).`);
  } else if (bw) {
    lines.push(`Bodyweight: ${w(bw.latestKg)} (one entry).`);
  }

  // Program
  const p = s.program;
  if (p) {
    lines.push(
      `Active program: ${p.name} (${p.source}${p.editable ? ", user's own — swaps can be applied" : ", library program — can't be edited; swaps happen in the workout logger"}), week ${p.week}/${p.durationWeeks}${p.isDeload ? " (deload week)" : ""}${p.weekFocus ? `, focus: ${p.weekFocus}` : ""}. Next workout: day ${p.nextDay}.`,
    );
    for (const d of p.days) {
      const marker = d.dayNumber === p.nextDay ? " ← next" : "";
      lines.push(`- Day ${d.dayNumber} ${d.name}${d.focus ? ` (${d.focus})` : ""}${marker}: ${d.exercises.map(describeProgramExercise).join("; ") || "no exercises"}`);
    }
  } else {
    lines.push("Active program: none.");
  }

  // Adherence
  const a = adherence(s.sessionDates, s.today, s.daysPerWeek);
  lines.push(
    `Consistency: ${a.last28} sessions in the last 28 days${a.planned ? ` of ~${a.planned} planned (${a.pct}%)` : ""}; ${a.weekStreak}-week streak, ${a.dayStreak}-day streak; last session ${a.lastSession ?? "never"}.`,
  );

  // Workouts
  const max = opts.maxWorkouts ?? 10;
  const workouts = s.workouts.slice(0, max);
  if (workouts.length) {
    lines.push(`Recent workouts (newest first, top set per exercise, e1RM in brackets):`);
    for (const wo of workouts) {
      const parts = wo.exercises.map((e) => {
        if (e.skipped) return `${e.name} skipped${e.skipReason ? ` (${e.skipReason})` : ""}`;
        const top = topSet(e.sets);
        if (!top) return `${e.name} no sets`;
        return `${e.name} ${e.sets.length}s top ${describeSet(top, u)}${top.e1rmKg ? ` [${w(top.e1rmKg)}]` : ""}`;
      });
      lines.push(`- ${wo.date} ${wo.name}: ${parts.join("; ")}`);
    }
    const trends = liftTrends(s.workouts).slice(0, 6);
    if (trends.length) {
      lines.push(
        `e1RM trends: ${trends
          .map((tr) => `${tr.name} ${w(tr.firstE1rmKg)}→${w(tr.lastE1rmKg)} (${tr.changePct >= 0 ? "+" : ""}${tr.changePct}% over ${tr.sessions} sessions${tr.sessionsSinceBest >= 2 ? `, no new best in ${tr.sessionsSinceBest} sessions` : ""})`)
          .join("; ")}.`,
      );
    }
  } else {
    lines.push("Workouts: none logged yet.");
  }
  if (s.prs.length) lines.push(`Best e1RMs: ${s.prs.map((r) => `${r.name} ${w(r.e1rmKg)} (${r.achievedOn})`).join("; ")}.`);

  // Other signals
  if (s.steps.length) {
    const avg = Math.round(s.steps.reduce((acc, d) => acc + d.steps, 0) / s.steps.length);
    lines.push(`Steps: avg ${avg.toLocaleString("en-US")}/day over ${s.steps.length} logged days${s.stepGoal ? ` (goal ${s.stepGoal.toLocaleString("en-US")})` : ""}.`);
  }
  if (s.readiness) lines.push(`Latest readiness check-in: ${s.readiness.score}/100 on ${s.readiness.date}.`);
  if (s.sleep && s.sleep.nights14 > 0) {
    const h = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
    const last = s.sleep.lastNight ? `last night ${h(s.sleep.lastNight.asleepMinutes)}${s.sleep.lastNight.inBedOnly ? " (time in bed; no detail entered)" : ""} on ${s.sleep.lastNight.date}` : "no night logged in the last day";
    lines.push(`Sleep (logged, not measured): ${last}; ${h(s.sleep.avg14 ?? 0)} average over ${s.sleep.nights14} of the last 14 nights; goal ${h(s.sleep.goalMinutes)}. Use get_sleep_summary for anything beyond this.`);
  }
  lines.push(`Supplement stack: ${s.supplements.length ? s.supplements.join(", ") : "none"}.`);
  if (s.challenge) lines.push(`Challenge: ${s.challenge.name}, day ${s.challenge.day}/${s.challenge.totalDays}, ${s.challenge.completedDays} days completed.`);
  const shared = (s.sharedJournal ?? []).filter((j) => j.excerpt);
  if (shared.length) {
    lines.push("Journal entries the athlete chose to share with you (private; refer to them gently and only when relevant):");
    for (const j of shared) {
      const head = [JOURNAL_KIND_LABELS[j.kind], j.title, j.scriptureRef, j.answeredOn ? `answered ${j.answeredOn}` : null].filter(Boolean).join(", ");
      lines.push(`- ${j.date} (${head}): ${j.excerpt}`);
    }
  }
  return lines.join("\n");
}

/** Starter questions tailored to the athlete's data (shown on an empty chat). */
export function suggestedQuestions(s: Pick<AthleteSnapshot, "workouts" | "program" | "targets" | "goal" | "weights" | "today">): string[] {
  const out: string[] = [];
  const trends = liftTrends(s.workouts);
  const stalled = trends.find((t) => t.sessionsSinceBest >= 2 || t.changePct <= 0);
  if (stalled) out.push(`Why did my ${stalled.name.toLowerCase()} stall?`);
  else if (trends[0]) out.push(`How should I progress my ${trends[0].name.toLowerCase()} next week?`);
  if (s.program) {
    const next = s.program.days.find((d) => d.dayNumber === s.program!.nextDay);
    out.push(next ? `What should I eat before today's ${next.name} workout?` : "What should I eat before my workout today?");
    out.push(s.program.isDeload ? "How should I run this deload week?" : "Plan my deload");
  } else {
    out.push("What should I eat before my workout today?");
    out.push("Which program fits my goal and schedule?");
  }
  if (s.targets) out.push("Am I eating enough protein for my goal?");
  if (s.goal === "lose_fat" && s.weights.length >= 2) out.push("Am I losing weight at a good pace?");
  else if (s.goal === "build_muscle") out.push("How much should I eat to gain muscle without much fat?");
  if (!s.workouts.length) out.push("How should I start if I'm new to lifting?");
  out.push("Suggest a swap for an exercise that bothers my shoulder");
  return [...new Set(out)].slice(0, 6);
}
