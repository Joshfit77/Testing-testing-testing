/**
 * Adaptive training review (Pro): reads the member's real logs and turns them into explained recommendations
 * (pure, unit-tested; data loading is in src/server/services/adaptive-training.ts).
 *
 * Rules, all deliberately conservative and transparent:
 *   - Only what was logged counts. Nothing is inferred about injuries, illness or medical conditions, and recovery
 *     advice uses only the member's own recovery check-ins and logged effort (RPE).
 *   - Each recommendation lists the evidence it rests on, in numbers the member can check, and what is missing.
 *   - Nothing is changed by this module: a recommendation becomes a change only when the member accepts it.
 */
import { z } from "zod";
import { addDays } from "./dates";
import { BODY_REGION_LABELS, LOWER_BODY, primaryRegions, regionShares, WEEKLY_SET_RANGES, type BodyRegion } from "./body-regions";
import { estimateOneRepMax } from "./strength";
import { displayWeight, KG_PER_LB, weightUnit } from "./units";
import type { UnitSystem } from "./types";

export interface ReviewSet {
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
}

export interface ReviewExercise {
  slug: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  /** Dumbbells / kettlebells progress in smaller steps. */
  equipment: string[];
  /** Completed working sets (no warm-ups). */
  sets: ReviewSet[];
  /** What the program prescribed for this exercise in that session, when it came from the program. */
  prescribed?: { reps: string | null; rpe: number | null } | null;
}

export interface ReviewWorkout {
  date: string;
  exercises: ReviewExercise[];
}

export interface ReviewProgramExercise {
  id: string;
  slug: string;
  name: string;
  sets: number;
  reps: string | null;
  rpe: number | null;
  primaryMuscles: string[];
}

export interface ReviewProgram {
  programId: string;
  name: string;
  editable: boolean;
  goals: string[];
  currentWeek: number;
  currentDay: number;
  durationWeeks: number;
  daysPerWeek: number;
  startedOn: string | null;
  /** Every week of the program: whether it is a deload. */
  weeks: { weekNumber: number; isDeload: boolean }[];
  /** The exercises of the week a change would apply to (all days). */
  upcoming: { weekNumber: number; exercises: ReviewProgramExercise[] };
}

export interface ReviewCheckin {
  date: string;
  readiness: number;
}

/** Logged sleep for the last two weeks (Sleep & Recovery). Absent when the member hasn't logged any. */
export interface ReviewSleep {
  goalMinutes: number;
  nights: { date: string; asleepMinutes: number }[];
}

export interface ReviewInput {
  today: string;
  units: UnitSystem;
  goal: string | null;
  goalChangedAfterProgramStart: boolean;
  workouts: ReviewWorkout[];
  program: ReviewProgram | null;
  checkins: ReviewCheckin[];
  /** Approved target loads already set, by exercise slug (kg). */
  targets: Record<string, { weightKg: number | null; reps: number | null }>;
  /** Recommendation keys the member already accepted or turned down (they aren't shown again). */
  decided: Set<string>;
  sleep?: ReviewSleep | null;
}

export type TrainingChange =
  | { kind: "exercise_target"; exerciseSlug: string; exerciseName: string; weightKg: number; reps: number | null }
  | { kind: "deload_week"; programId: string; weekNumber: number; setsFactor: number; rpeCap: number }
  | { kind: "volume_change"; programId: string; exerciseSlug: string; exerciseName: string; fromWeek: number; deltaSets: number };

export type RecommendationKind = "progress_load" | "plateau" | "deload" | "volume" | "frequency" | "goal_change" | "low_readiness" | "short_sleep";

export interface Recommendation {
  key: string;
  kind: RecommendationKind;
  title: string;
  summary: string;
  /** The numbers it rests on. */
  why: string[];
  confidence: "high" | "moderate" | "low";
  /** The change the member can accept (and adjust), or null for advice that changes nothing in the app. */
  change: TrainingChange | null;
  /** Where to make it instead, for changes handled by another screen. */
  link?: { href: string; label: string };
  /** Why it can't be applied here, if it can't. */
  blocked?: string;
}

export interface TrainingReview {
  windowDays: number;
  consistency: { sessionsLast28: number; plannedLast28: number | null; pct: number | null; lastSession: string | null; missedThisWeek: number | null };
  volume: { region: BodyRegion; label: string; setsPerWeek: number; range: [number, number] | null; status: "below" | "within" | "above" | "untracked" }[];
  lifts: { slug: string; name: string; sessions: number; firstE1rmKg: number; lastE1rmKg: number; bestE1rmKg: number; changePct: number; sessionsSinceBest: number; plateau: boolean }[];
  recovery: {
    checkins: number;
    avgReadiness7: number | null;
    latest: ReviewCheckin | null;
    rpeDrift: number | null;
    rpePoints: number;
    /** Logged sleep over the last 7 nights, when any was logged. Never inferred. */
    sleep: { nights7: number; avgAsleep7: number | null; goalMinutes: number } | null;
  };
  weeksSinceDeload: number | null;
  recommendations: Recommendation[];
  dataGaps: string[];
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Upper end of a prescribed rep target ("8-12" → 12, "5" → 5, "AMRAP" → null). */
export function repTarget(reps: string | null | undefined): number | null {
  if (!reps) return null;
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length || /amrap|max/i.test(reps)) return null;
  return Math.max(...nums);
}

/** Next load step: 5 kg / 10 lb for lower-body barbell lifts, 2 kg / 5 lb per hand for dumbbells, otherwise 2.5 kg / 5 lb. */
export function loadIncrementKg(regions: BodyRegion[], equipment: string[], units: UnitSystem): number {
  const handheld = equipment.some((e) => e === "dumbbells" || e === "kettlebells");
  if (units === "imperial") return (handheld ? 5 : regions.some((r) => LOWER_BODY.has(r)) ? 10 : 5) * KG_PER_LB;
  return handheld ? 2 : regions.some((r) => LOWER_BODY.has(r)) ? 5 : 2.5;
}

/** Round to a loadable weight in the member's units (2.5 kg / 5 lb steps), returned in kg. */
export function roundLoadKg(kg: number, units: UnitSystem): number {
  if (units === "imperial") return Math.round(kg / KG_PER_LB / 5) * 5 * KG_PER_LB;
  return Math.round(kg / 2.5) * 2.5;
}

function topWeight(sets: ReviewSet[]): number | null {
  const w = sets.map((s) => s.weightKg ?? 0).filter((x) => x > 0);
  return w.length ? Math.max(...w) : null;
}

function bestE1rm(sets: ReviewSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.weightKg || !s.reps) continue;
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

export function analyzeTraining(input: ReviewInput): TrainingReview {
  const { today, units } = input;
  const w = (kg: number) => `${displayWeight(kg, units)} ${weightUnit(units)}`;
  const since28 = addDays(today, -27);
  const since56 = addDays(today, -55);
  const workouts = input.workouts.filter((x) => x.date >= since56 && x.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const dataGaps: string[] = [];
  const recs: Recommendation[] = [];
  const add = (r: Recommendation) => {
    if (!input.decided.has(r.key)) recs.push(r);
  };

  // Consistency ------------------------------------------------------------------------------------------------
  const sessionDays = new Set(workouts.filter((x) => x.date >= since28).map((x) => x.date));
  const program = input.program;
  const programDays = program?.startedOn ? Math.max(1, Math.round((Date.parse(today) - Date.parse(program.startedOn)) / 86_400_000) + 1) : null;
  const plannedWindow = programDays ? Math.min(28, programDays) : 28;
  const plannedLast28 = program ? Math.round((program.daysPerWeek * plannedWindow) / 7) : null;
  const sessionsInWindow = new Set(workouts.filter((x) => x.date >= addDays(today, -(plannedWindow - 1))).map((x) => x.date)).size;
  const consistency = {
    sessionsLast28: sessionDays.size,
    plannedLast28,
    pct: plannedLast28 ? Math.min(100, Math.round((sessionsInWindow / plannedLast28) * 100)) : null,
    lastSession: workouts.at(-1)?.date ?? null,
    missedThisWeek: null as number | null,
  };
  if (program) {
    const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const doneThisWeek = new Set(workouts.filter((x) => x.date >= weekStart).map((x) => x.date)).size;
    const daysLeft = 7 - ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7);
    consistency.missedThisWeek = Math.max(0, program.daysPerWeek - doneThisWeek - daysLeft);
  }
  if (workouts.length < 4) dataGaps.push(`Only ${workouts.length} logged workout${workouts.length === 1 ? "" : "s"} in the last 8 weeks, so trends are limited.`);

  // Weekly volume per region (last 3 full weeks of logs, or fewer if training started recently) -------------------
  const volWindowStart = addDays(today, -20);
  const firstLog = workouts[0]?.date ?? today;
  const volDays = Math.max(7, Math.min(21, Math.round((Date.parse(today) - Date.parse(firstLog > volWindowStart ? firstLog : volWindowStart)) / 86_400_000) + 1));
  const regionSets = new Map<BodyRegion, number>();
  for (const wo of workouts.filter((x) => x.date >= volWindowStart)) {
    for (const e of wo.exercises) {
      const shares = regionShares(e.primaryMuscles, e.secondaryMuscles);
      for (const [r, share] of shares) regionSets.set(r, (regionSets.get(r) ?? 0) + share * e.sets.length);
    }
  }
  const trainedByProgram = new Set((program?.upcoming.exercises ?? []).flatMap((e) => primaryRegions(e.primaryMuscles)));
  const volume = (Object.keys(BODY_REGION_LABELS) as BodyRegion[]).map((region) => {
    const setsPerWeek = round(((regionSets.get(region) ?? 0) * 7) / volDays, 1);
    const range = WEEKLY_SET_RANGES[region] ?? null;
    const status: TrainingReview["volume"][number]["status"] = !range ? "untracked" : setsPerWeek < range[0] ? "below" : setsPerWeek > range[1] ? "above" : "within";
    return { region, label: BODY_REGION_LABELS[region], setsPerWeek, range, status };
  });

  // Lifts: e1RM trend and plateaus -------------------------------------------------------------------------------
  const series = new Map<string, { name: string; ex: ReviewExercise; points: { date: string; e1rm: number; top: number; sets: ReviewSet[]; prescribed: ReviewExercise["prescribed"] }[] }>();
  for (const wo of workouts) {
    for (const e of wo.exercises) {
      const e1 = bestE1rm(e.sets);
      const top = topWeight(e.sets);
      if (e1 == null || top == null) continue;
      const s = series.get(e.slug) ?? { name: e.name, ex: e, points: [] };
      s.points.push({ date: wo.date, e1rm: e1, top, sets: e.sets, prescribed: e.prescribed });
      s.ex = e;
      series.set(e.slug, s);
    }
  }
  const lifts: TrainingReview["lifts"] = [];
  for (const [slug, s] of series) {
    if (s.points.length < 2) continue;
    let bestIdx = 0;
    s.points.forEach((p, i) => {
      if (p.e1rm > s.points[bestIdx]!.e1rm + 1e-6) bestIdx = i;
    });
    const first = s.points[0]!;
    const last = s.points.at(-1)!;
    const span = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
    const sessionsSinceBest = s.points.length - 1 - bestIdx;
    lifts.push({
      slug,
      name: s.name,
      sessions: s.points.length,
      firstE1rmKg: round(first.e1rm, 1),
      lastE1rmKg: round(last.e1rm, 1),
      bestE1rmKg: round(s.points[bestIdx]!.e1rm, 1),
      changePct: round(((last.e1rm - first.e1rm) / first.e1rm) * 100, 1),
      sessionsSinceBest,
      plateau: s.points.length >= 4 && span >= 21 && sessionsSinceBest >= 3,
    });
  }
  lifts.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));

  // Recovery signals ---------------------------------------------------------------------------------------------
  const recent = input.checkins.filter((c) => c.date >= addDays(today, -6) && c.date <= today);
  const avgReadiness7 = recent.length ? Math.round(recent.reduce((a, c) => a + c.readiness, 0) / recent.length) : null;
  const latest = [...input.checkins].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const drift: number[] = [];
  for (const wo of workouts.filter((x) => x.date >= addDays(today, -13))) {
    for (const e of wo.exercises) {
      const target = e.prescribed?.rpe;
      if (!target) continue;
      const logged = e.sets.map((s) => s.rpe).filter((r): r is number => r != null);
      if (logged.length) drift.push(Math.max(...logged) - target);
    }
  }
  const rpeDrift = drift.length >= 4 ? round(drift.reduce((a, b) => a + b, 0) / drift.length, 1) : null;
  if (!input.checkins.length) dataGaps.push("No recovery check-ins in the last two weeks, so recovery-based advice uses logged effort only.");
  if (rpeDrift == null) dataGaps.push("Not enough sets with a logged RPE against a prescribed RPE to judge whether sessions feel harder than planned.");

  // Logged sleep (Sleep & Recovery): the last 7 nights against the member's goal. Advice only, never a program change.
  const sleep7 = (input.sleep?.nights ?? []).filter((n) => n.date >= addDays(today, -6) && n.date <= today);
  const avgAsleep7 = sleep7.length ? Math.round(sleep7.reduce((a, n) => a + n.asleepMinutes, 0) / sleep7.length) : null;
  const sleepSummary = input.sleep && input.sleep.nights.length ? { nights7: sleep7.length, avgAsleep7, goalMinutes: input.sleep.goalMinutes } : null;
  if (!sleepSummary) dataGaps.push("No sleep logged in the last two weeks, so sleep isn't part of this review.");

  // Weeks since the last deload in this program ------------------------------------------------------------------
  let weeksSinceDeload: number | null = null;
  if (program) {
    const pastDeloads = program.weeks.filter((x) => x.isDeload && x.weekNumber < program.currentWeek).map((x) => x.weekNumber);
    weeksSinceDeload = program.currentWeek - (pastDeloads.length ? Math.max(...pastDeloads) : 0) - 1;
  }

  // Recommendations ----------------------------------------------------------------------------------------------
  const plateaued = lifts.filter((l) => l.plateau);
  const recoveryLow = avgReadiness7 != null && recent.length >= 3 && avgReadiness7 < 50;
  const effortHigh = rpeDrift != null && rpeDrift >= 1;

  // 1. Load progression: the last two sessions hit the prescribed reps at the same load, at or under the target RPE.
  for (const [slug, s] of series) {
    const pts = s.points.filter((p) => p.date >= addDays(today, -21)).slice(-2);
    if (pts.length < 2) continue;
    const [a, b] = pts as [(typeof pts)[number], (typeof pts)[number]];
    const target = repTarget(b.prescribed?.reps ?? a.prescribed?.reps);
    if (!target || b.top < a.top) continue;
    const hit = (p: typeof a) => {
      const atTop = p.sets.filter((x) => x.weightKg === p.top);
      const rpeLimit = p.prescribed?.rpe ?? 8;
      return atTop.length >= 1 && atTop.every((x) => (x.reps ?? 0) >= target) && atTop.every((x) => x.rpe == null || x.rpe <= rpeLimit);
    };
    if (!hit(a) || !hit(b) || Math.abs(a.top - b.top) > 0.01) continue;
    if (lifts.find((l) => l.slug === slug)?.plateau) continue;
    const regions = primaryRegions(s.ex.primaryMuscles);
    const next = roundLoadKg(b.top + Math.min(loadIncrementKg(regions, s.ex.equipment, units), b.top * 0.1 + 0.01), units);
    if (next <= b.top) continue;
    const existing = input.targets[slug];
    if (existing?.weightKg != null && existing.weightKg >= next - 0.01) continue;
    const rpeNote = b.sets.some((x) => x.rpe != null) ? ` at RPE ${Math.max(...b.sets.map((x) => x.rpe ?? 0))} or less` : "";
    add({
      key: `progress:${slug}:${b.date}`,
      kind: "progress_load",
      title: `Add load to ${s.name}`,
      summary: `Next time, aim for ${w(next)} × ${target}.`,
      why: [
        `${a.date} and ${b.date}: every set at ${w(b.top)} reached ${target}+ reps${rpeNote}.`,
        `The program asks for ${b.prescribed?.reps ?? a.prescribed?.reps} reps${b.prescribed?.rpe ? ` at RPE ${b.prescribed.rpe}` : ""}, so the load can go up one step.`,
      ],
      confidence: "high",
      change: { kind: "exercise_target", exerciseSlug: slug, exerciseName: s.name, weightKg: round(next, 2), reps: target },
    });
  }

  // 2. Plateaus: reset the load and build back.
  for (const l of plateaued) {
    const s = series.get(l.slug)!;
    const last = s.points.at(-1)!;
    const reset = roundLoadKg(last.top * 0.9, units);
    const reps = repTarget(last.prescribed?.reps) ?? Math.max(...last.sets.map((x) => x.reps ?? 0));
    add({
      key: `plateau:${l.slug}:${last.date}`,
      kind: "plateau",
      title: `${l.name} has stalled`,
      summary: `Reset to about ${w(reset)} × ${reps} and add a step each week, rather than grinding at ${w(last.top)}.`,
      why: [
        `No new best estimated 1-rep max in the last ${l.sessionsSinceBest} sessions (best ${w(l.bestE1rmKg)}, latest ${w(l.lastE1rmKg)}).`,
        `${l.sessions} sessions logged since ${s.points[0]!.date}.`,
        "Other options if you prefer: change the rep range for a block, or a close variation that trains the sticking point.",
        recoveryLow || effortHigh ? "Your recovery signals are also low, which often explains a stall." : "Check sleep and food too: a stall is often recovery, not the program.",
      ],
      confidence: "moderate",
      change: reps > 0 ? { kind: "exercise_target", exerciseSlug: l.slug, exerciseName: l.name, weightKg: round(reset, 2), reps } : null,
    });
  }

  // 3. Recovery week.
  if (program && weeksSinceDeload != null && sessionDays.size >= 6) {
    const nextWeek = program.weeks.find((x) => x.weekNumber === program.upcoming.weekNumber);
    const signals = [
      recoveryLow ? `Average readiness ${avgReadiness7}/100 over your last ${recent.length} check-ins (below 50).` : null,
      effortHigh ? `Sessions are feeling harder than planned: logged RPE is ${rpeDrift} above the program's target on average (${drift.length} exercises, last 2 weeks).` : null,
      plateaued.length >= 2 ? `${plateaued.length} lifts have stalled: ${plateaued.map((p) => p.name).join(", ")}.` : null,
    ].filter((x): x is string => Boolean(x));
    const due = weeksSinceDeload >= 4 && signals.length >= 1;
    const overdue = weeksSinceDeload >= 8;
    if ((due || overdue) && nextWeek && !nextWeek.isDeload) {
      add({
        key: `deload:${program.programId}:${program.upcoming.weekNumber}`,
        kind: "deload",
        title: `Make week ${program.upcoming.weekNumber} a recovery week`,
        summary: "Same exercises and days, about 40% fewer sets, and effort capped at RPE 7.",
        why: [`${weeksSinceDeload} weeks of training since the last lighter week in this program.`, ...signals, signals.length ? "" : "It has been a long block without a lighter week; a planned one helps you keep progressing."].filter(Boolean),
        confidence: signals.length >= 2 ? "high" : signals.length === 1 ? "moderate" : "low",
        change: program.editable ? { kind: "deload_week", programId: program.programId, weekNumber: program.upcoming.weekNumber, setsFactor: 0.6, rpeCap: 7 } : null,
        blocked: program.editable ? undefined : "This is a library program, which can't be edited. For a recovery week, do about 60% of the sets at RPE 7 or less.",
      });
    }
  }

  // 4. Weekly volume (muscle-building goals only, regions the program trains, with recovery in mind).
  const growthGoal = !input.goal || ["build_muscle", "general_health", "lose_fat", "build_strength"].includes(input.goal);
  if (program?.editable && growthGoal && workouts.length >= 6 && volDays >= 14) {
    for (const v of volume) {
      if (!v.range || !trainedByProgram.has(v.region)) continue;
      const candidates = program.upcoming.exercises.filter((e) => primaryRegions(e.primaryMuscles).includes(v.region));
      if (!candidates.length) continue;
      if (v.setsPerWeek < v.range[0] - 2 && !recoveryLow && !effortHigh) {
        const ex = [...candidates].sort((a, b) => a.sets - b.sets)[0]!;
        if (ex.sets >= 6) continue;
        add({
          key: `volume:${v.region}:up:${program.programId}:${program.upcoming.weekNumber}`,
          kind: "volume",
          title: `More ${v.label.toLowerCase()} work`,
          summary: `Add 1 set to ${ex.name} from week ${program.upcoming.weekNumber} on.`,
          why: [
            `About ${v.setsPerWeek} working sets a week for ${v.label.toLowerCase()} over the last ${volDays} days; a common range for growth is ${v.range[0]}–${v.range[1]}.`,
            "Recovery signals don't argue against a little more.",
          ],
          confidence: "moderate",
          change: { kind: "volume_change", programId: program.programId, exerciseSlug: ex.slug, exerciseName: ex.name, fromWeek: program.upcoming.weekNumber, deltaSets: 1 },
        });
      } else if (v.setsPerWeek > v.range[1] + 4 && (recoveryLow || effortHigh)) {
        const ex = [...candidates].sort((a, b) => b.sets - a.sets)[0]!;
        if (ex.sets <= 2) continue;
        add({
          key: `volume:${v.region}:down:${program.programId}:${program.upcoming.weekNumber}`,
          kind: "volume",
          title: `Less ${v.label.toLowerCase()} volume`,
          summary: `Drop 1 set from ${ex.name} from week ${program.upcoming.weekNumber} on.`,
          why: [`About ${v.setsPerWeek} working sets a week for ${v.label.toLowerCase()}, above the usual ${v.range[0]}–${v.range[1]}.`, recoveryLow ? `Readiness is low (${avgReadiness7}/100).` : `Logged effort is above plan (RPE +${rpeDrift}).`],
          confidence: "moderate",
          change: { kind: "volume_change", programId: program.programId, exerciseSlug: ex.slug, exerciseName: ex.name, fromWeek: program.upcoming.weekNumber, deltaSets: -1 },
        });
      }
    }
  }

  // 5. Training frequency: many planned sessions missed.
  if (program && programDays && programDays >= 14 && plannedLast28 && plannedLast28 >= 4 && consistency.pct != null && consistency.pct <= 60 && program.daysPerWeek > 2) {
    const fewer = program.daysPerWeek - 1;
    add({
      key: `frequency:${program.programId}:${program.daysPerWeek}:${today.slice(0, 7)}`,
      kind: "frequency",
      title: `Try ${fewer} training days a week`,
      summary: `A plan you can keep beats a bigger one you miss.`,
      why: [`${sessionsInWindow} of about ${plannedLast28} planned sessions done in the last ${plannedWindow} days (${consistency.pct}%).`, `A ${fewer}-day program would cover the same muscles with fewer, slightly longer sessions.`],
      confidence: "moderate",
      change: null,
      link: { href: `/profile/preferences?days=${fewer}#schedule`, label: `Preview a ${fewer}-day schedule` },
    });
  }

  // 6. Goal changed since the program started.
  if (program && input.goalChangedAfterProgramStart && input.goal && !program.goals.includes(input.goal)) {
    add({
      key: `goal:${program.programId}:${input.goal}`,
      kind: "goal_change",
      title: "Your goal changed",
      summary: `${program.name} was built for a different goal. Consider a program built for your new one.`,
      why: [`Current goal: ${input.goal.replace(/_/g, " ")}. Program goals: ${program.goals.map((g) => g.replace(/_/g, " ")).join(", ") || "not set"}.`],
      confidence: "moderate",
      change: null,
      link: { href: "/train/programs", label: "See programs" },
    });
  }

  // 7. Today's check-in is low: advice only.
  if (latest && latest.date === today && latest.readiness < 45) {
    add({
      key: `readiness:${today}`,
      kind: "low_readiness",
      title: "Take today lighter",
      summary: "Keep the session but trim a set per exercise and keep effort around RPE 6–7, or swap in mobility or an easy walk.",
      why: [`Today's check-in readiness is ${latest.readiness}/100.`, "If you feel unwell or have pain, rest and talk to a qualified professional."],
      confidence: "moderate",
      change: null,
    });
  }

  // 8. Short on sleep this week: advice only (nothing changes unless the member chooses to).
  if (sleepSummary && avgAsleep7 !== null && sleep7.length >= 3 && avgAsleep7 < sleepSummary.goalMinutes - 60) {
    const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const fmt = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
    add({
      key: `sleep:${weekStart}`,
      kind: "short_sleep",
      title: "Short on sleep this week",
      summary: "Keep the plan, but don't chase new loads until you've had a few nights near your goal, and protect the night before your hardest session.",
      why: [`Average ${fmt(avgAsleep7)} asleep over ${sleep7.length} logged nights against a ${fmt(sleepSummary.goalMinutes)} goal.`, "From what you logged, not a measurement. Short sleep on its own doesn't predict injury."],
      confidence: "moderate",
      change: null,
      link: { href: "/progress/sleep", label: "Sleep & Recovery" },
    });
  }

  const order: Record<RecommendationKind, number> = { low_readiness: 0, short_sleep: 1, deload: 2, plateau: 3, progress_load: 4, volume: 5, frequency: 6, goal_change: 7 };
  recs.sort((a, b) => order[a.kind] - order[b.kind]);
  return {
    windowDays: 56,
    consistency,
    volume,
    lifts,
    recovery: { checkins: input.checkins.length, avgReadiness7, latest, rpeDrift, rpePoints: drift.length, sleep: sleepSummary },
    weeksSinceDeload,
    recommendations: recs,
    dataGaps,
  };
}

/** Compact text for the AI coach's training-review tool. */
export function describeReviewForCoach(r: TrainingReview, units: UnitSystem) {
  const w = (kg: number) => `${displayWeight(kg, units)} ${weightUnit(units)}`;
  return {
    consistency: r.consistency,
    weekly_sets_by_region: r.volume.filter((v) => v.setsPerWeek > 0 || v.range).map((v) => ({ region: v.label, sets_per_week: v.setsPerWeek, usual_range: v.range, status: v.status })),
    lifts: r.lifts.slice(0, 10).map((l) => ({ lift: l.name, slug: l.slug, sessions: l.sessions, e1rm_first: w(l.firstE1rmKg), e1rm_last: w(l.lastE1rmKg), e1rm_best: w(l.bestE1rmKg), change_pct: l.changePct, sessions_since_best: l.sessionsSinceBest, plateau: l.plateau })),
    recovery: r.recovery,
    weeks_since_lighter_week: r.weeksSinceDeload,
    app_recommendations: r.recommendations.map((x) => ({ title: x.title, summary: x.summary, why: x.why, confidence: x.confidence, can_apply: Boolean(x.change) })),
    data_gaps: r.dataGaps,
  };
}

/** What the member may adjust before accepting a change ("Modify"). Weights are in their display unit. */
export const trainingModifySchema = z
  .object({
    weight: z.number().positive().max(2000).optional(),
    reps: z.number().int().min(1).max(100).nullable().optional(),
    setsPercent: z.number().int().min(40).max(80).optional(),
    rpeCap: z.number().min(5).max(8).optional(),
    deltaSets: z
      .number()
      .int()
      .min(-2)
      .max(2)
      .refine((n) => n !== 0, "Change by at least one set.")
      .optional(),
  })
  .strict();
export type TrainingModification = z.infer<typeof trainingModifySchema>;

export function applyModification(change: TrainingChange, mod: TrainingModification, units: UnitSystem): TrainingChange {
  if (change.kind === "exercise_target") {
    const weightKg = mod.weight != null ? Math.round((units === "imperial" ? mod.weight * KG_PER_LB : mod.weight) * 100) / 100 : change.weightKg;
    return { ...change, weightKg, reps: mod.reps !== undefined ? mod.reps : change.reps };
  }
  if (change.kind === "deload_week") return { ...change, setsFactor: mod.setsPercent != null ? mod.setsPercent / 100 : change.setsFactor, rpeCap: mod.rpeCap ?? change.rpeCap };
  return mod.deltaSets != null ? { ...change, deltaSets: mod.deltaSets } : change;
}

export const trainingChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exercise_target"), exerciseSlug: z.string().regex(/^[a-z0-9-]{2,80}$/), exerciseName: z.string().max(120), weightKg: z.number().positive().max(1000), reps: z.number().int().min(1).max(100).nullable() }),
  z.object({ kind: z.literal("deload_week"), programId: z.string().uuid(), weekNumber: z.number().int().min(1).max(52), setsFactor: z.number().min(0.4).max(0.8), rpeCap: z.number().min(5).max(8) }),
  z.object({ kind: z.literal("volume_change"), programId: z.string().uuid(), exerciseSlug: z.string().regex(/^[a-z0-9-]{2,80}$/), exerciseName: z.string().max(120), fromWeek: z.number().int().min(1).max(52), deltaSets: z.number().int().min(-2).max(2) }),
]);
