/**
 * Deterministic lift-progress analysis for the AI coach (analyze_lift_progress).
 *
 * Every number and every finding comes from the member's own logged sets through fixed rules here; the model only
 * explains them. Nothing is extrapolated: a metric that lacks data is null, and thin data returns only
 * `insufficient_data`. Pure (no I/O) so it can be unit-tested with fixtures.
 */
import { addDays, daysBetween } from "@/lib/domain/dates";
import { estimateOneRepMax } from "@/lib/domain/strength";
import type { UnitSystem } from "@/lib/domain/types";
import { displayWeight, weightUnit } from "@/lib/domain/units";

/** A completed, non-warm-up set. */
export interface AnalysisSet {
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  seconds?: number | null;
}

/** One session in which the lift was performed (not skipped). */
export interface AnalysisSession {
  date: string;
  sets: AnalysisSet[];
}

export interface SleepNightInput {
  date: string;
  asleepMinutes: number;
  /** Recorded by a wearable / health platform (nothing entered by hand). */
  recorded: boolean;
  /** "Asleep" is time in bed (no fell-asleep or awake detail). */
  estimated: boolean;
}

export interface CheckinInput {
  date: string;
  readiness: number;
  energy: number;
  soreness: number;
  stress: number;
  sleepQuality: number;
}

export interface ProgramAttendanceInput {
  name: string;
  daysPerWeek: number;
  startedOn: string | null;
  /** Dates of completed sessions logged against this program. */
  completedDates: string[];
}

export interface Finding {
  id: string;
  evidence: string;
}

// --------------------------------------------------------------------------- shared helpers

/** A working set counts as hard unless its logged RPE is below 6 (sets without RPE count). */
export const HARD_SET_MIN_RPE = 6;
export const isHardSet = (s: AnalysisSet) => ((s.reps ?? 0) > 0 || (s.seconds ?? 0) > 0) && (s.rpe == null || s.rpe >= HARD_SET_MIN_RPE);

export const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const r1 = (n: number | null): number | null => (n == null ? null : Math.round(n * 10) / 10);
export const pctChange = (from: number, to: number): number | null => (from > 0 ? Math.round(((to - from) / from) * 1000) / 10 : null);

/** First day of a window of `weeks` rolling 7-day weeks that ends today (inclusive). */
export const windowStart = (today: string, weeks: number) => addDays(today, -(weeks * 7 - 1));
export const inRange = (date: string, from: string, to: string) => date >= from && date <= to;

/** Best Epley e1RM of the session (loaded sets of 1–12 reps), in kg. */
export function sessionE1rm(sets: AnalysisSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.weightKg || !s.reps) continue;
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

const heaviest = (sets: AnalysisSet[]) => sets.reduce<number | null>((m, s) => (s.weightKg && (s.reps ?? 0) > 0 && (m == null || s.weightKg > m) ? s.weightKg : m), null);

export function summarizeSleepNights(nights: SleepNightInput[] | null, from: string, to: string) {
  if (nights == null) return null;
  const inWin = nights.filter((n) => inRange(n.date, from, to));
  if (!inWin.length) return { nights: 0, avg_asleep_hours: null, recorded_nights: 0, self_reported_nights: 0, in_bed_only_nights: 0 };
  return {
    nights: inWin.length,
    avg_asleep_hours: r1(mean(inWin.map((n) => n.asleepMinutes))! / 60),
    recorded_nights: inWin.filter((n) => n.recorded).length,
    self_reported_nights: inWin.filter((n) => !n.recorded).length,
    in_bed_only_nights: inWin.filter((n) => n.estimated).length,
  };
}

export function summarizeCheckins(checkins: CheckinInput[], from: string, to: string) {
  const c = checkins.filter((x) => inRange(x.date, from, to));
  if (!c.length) return null;
  const avg = (f: (x: CheckinInput) => number) => r1(mean(c.map(f)));
  return {
    count: c.length,
    readiness_avg: avg((x) => x.readiness),
    energy_avg: avg((x) => x.energy),
    soreness_avg: avg((x) => x.soreness),
    stress_avg: avg((x) => x.stress),
    sleep_quality_avg: avg((x) => x.sleepQuality),
    scale: "readiness 0–100 (higher = better); energy, soreness, stress, sleep quality 1–5 (soreness/stress: higher = more)",
  };
}

// --------------------------------------------------------------------------- analyze_lift_progress

export interface LiftAnalysisInput {
  exercise: { slug: string; name: string };
  today: string;
  weeks: number;
  units: UnitSystem;
  /** Every logged session with this lift (any order, any date): records need the full history. */
  sessions: AnalysisSession[];
  program: ProgramAttendanceInput | null;
  /** null = sleep not available (wellness data not allowed). */
  sleep: SleepNightInput[] | null;
  checkins: CheckinInput[];
}

export const MIN_SESSIONS = 4;
export const PLATEAU_MIN_SESSIONS = 6;
export const PLATEAU_DAYS = 28;
export const VOLUME_CHANGE_PCT = 25;
export const CONSISTENCY_MIN_PCT = 70;
export const SHORT_SLEEP_MINUTES = 7 * 60;
export const SHORT_SLEEP_MIN_NIGHTS = 5;
export const RPE_RISE = 0.5;

export function analyzeLiftProgress(input: LiftAnalysisInput) {
  const { today, weeks, units, exercise } = input;
  const unit = weightUnit(units);
  const w = (kg: number) => displayWeight(kg, units);
  const fmt = (kg: number) => `${w(kg)} ${unit}`;
  const start = windowStart(today, weeks);
  const name = exercise.name;

  const all = input.sessions
    .filter((s) => s.date <= today)
    .map((s) => ({ ...s, e1rm: sessionE1rm(s.sets), heaviest: heaviest(s.sets) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const inWin = all.filter((s) => s.date >= start);
  const firstEver = all[0]?.date ?? null;

  // Records over the whole history: a session sets a record when it beats every earlier session.
  let bestE = 0;
  let prevBestE: number | null = null;
  let bestEIdx = -1;
  let bestW = 0;
  let bestWIdx = -1;
  for (let i = 0; i < all.length; i++) {
    const s = all[i]!;
    if (s.e1rm != null && s.e1rm > bestE + 1e-9) {
      prevBestE = bestEIdx >= 0 ? bestE : null;
      bestE = s.e1rm;
      bestEIdx = i;
    }
    if (s.heaviest != null && s.heaviest > bestW + 1e-9) {
      bestW = s.heaviest;
      bestWIdx = i;
    }
  }
  const e1rmPr = bestEIdx >= 0 ? { date: all[bestEIdx]!.date, sessionsSince: all.length - 1 - bestEIdx, daysSince: daysBetween(all[bestEIdx]!.date, today) } : null;
  const weightPr = bestWIdx >= 0 ? { date: all[bestWIdx]!.date, sessionsSince: all.length - 1 - bestWIdx, daysSince: daysBetween(all[bestWIdx]!.date, today) } : null;

  // Weekly series over the weeks the lift has been trained (from the week of the first-ever session).
  const firstWeek = firstEver && firstEver > start ? Math.floor(daysBetween(start, firstEver) / 7) : 0;
  const weeksCovered = firstEver ? weeks - firstWeek : 0;
  const weekly = [];
  for (let k = firstWeek; firstEver && k < weeks; k++) {
    const ws = addDays(start, k * 7);
    const we = addDays(ws, 6);
    const ss = inWin.filter((s) => inRange(s.date, ws, we));
    const sets = ss.flatMap((s) => s.sets);
    const rpes = sets.map((x) => x.rpe).filter((x): x is number => x != null);
    const best = ss.reduce<number | null>((m, s) => (s.e1rm != null && (m == null || s.e1rm > m) ? s.e1rm : m), null);
    weekly.push({ week_start: ws, sessions: ss.length, hard_sets: sets.filter(isHardSet).length, best_e1rm: best == null ? null : w(best), avg_rpe: r1(mean(rpes)) });
  }
  const gapWeeks = weekly.filter((x) => x.sessions === 0).map((x) => x.week_start);

  // Last 4 weeks vs the 4 before (rolling, ending today), from the full history.
  const recentFrom = addDays(today, -27);
  const priorFrom = addDays(today, -55);
  const priorTo = addDays(today, -28);
  const recent = all.filter((s) => inRange(s.date, recentFrom, today));
  const prior = all.filter((s) => inRange(s.date, priorFrom, priorTo));
  // Weeks of the prior block the lift had already been trained in (a lift started 5 weeks ago has 1 prior week).
  const priorWeeks = firstEver == null || firstEver > priorTo ? 0 : Math.min(4, Math.ceil((daysBetween(firstEver < priorFrom ? priorFrom : firstEver, priorTo) + 1) / 7));
  const maxE = (ss: typeof all) => ss.reduce<number | null>((m, s) => (s.e1rm != null && (m == null || s.e1rm > m) ? s.e1rm : m), null);
  const hard = (ss: typeof all) => ss.flatMap((s) => s.sets).filter(isHardSet).length;
  const rpeOf = (ss: typeof all) => ss.flatMap((s) => s.sets).map((x) => x.rpe).filter((x): x is number => x != null);

  const recentE = maxE(recent);
  const priorE = maxE(prior);
  const recentSetsPerWeek = hard(recent) / 4;
  const priorSetsPerWeek = priorWeeks ? hard(prior) / priorWeeks : null;
  const setsChange = priorSetsPerWeek ? pctChange(priorSetsPerWeek, recentSetsPerWeek) : null;

  // Window-level e1RM: first vs last week with an e1RM.
  const eWeeks = weekly.filter((x) => x.best_e1rm != null);
  const firstEW = eWeeks[0];
  const lastEW = eWeeks.at(-1);
  const winRpes = rpeOf(inWin);

  // RPE at the same load and reps: last 4 weeks vs the 4 before.
  const loadKey = (s: AnalysisSet) => (s.weightKg && s.reps && s.rpe != null ? `${Math.round(s.weightKg * 2) / 2}|${s.reps}` : null);
  const groups = new Map<string, { kg: number; reps: number; recent: number[]; prior: number[] }>();
  for (const [bucket, ss] of [["recent", recent], ["prior", prior]] as const) {
    for (const s of ss.flatMap((x) => x.sets)) {
      const key = loadKey(s);
      if (!key) continue;
      const g = groups.get(key) ?? { kg: Math.round(s.weightKg! * 2) / 2, reps: s.reps!, recent: [], prior: [] };
      g[bucket].push(s.rpe!);
      groups.set(key, g);
    }
  }
  const sameLoad = [...groups.values()]
    .filter((g) => g.recent.length && g.prior.length)
    .sort((a, b) => Math.min(b.recent.length, b.prior.length) - Math.min(a.recent.length, a.prior.length) || b.recent.length + b.prior.length - (a.recent.length + a.prior.length) || b.kg - a.kg)[0];
  const sameLoadOut = sameLoad
    ? {
        load: w(sameLoad.kg),
        reps: sameLoad.reps,
        prior_4_weeks_avg_rpe: r1(mean(sameLoad.prior)),
        prior_sets: sameLoad.prior.length,
        last_4_weeks_avg_rpe: r1(mean(sameLoad.recent)),
        recent_sets: sameLoad.recent.length,
        change: r1(mean(sameLoad.recent)! - mean(sameLoad.prior)!),
      }
    : null;

  // Program attendance over the window (from when the program started, if later).
  let program = null as null | { name: string; days_per_week: number; from: string; planned_sessions: number; completed_sessions: number; pct: number };
  if (input.program) {
    const from = input.program.startedOn && input.program.startedOn > start ? input.program.startedOn : start;
    const days = daysBetween(from, today) + 1;
    if (days >= 7) {
      const planned = Math.round((input.program.daysPerWeek * days) / 7);
      const completed = input.program.completedDates.filter((d) => inRange(d, from, today)).length;
      if (planned > 0) program = { name: input.program.name, days_per_week: input.program.daysPerWeek, from, planned_sessions: planned, completed_sessions: completed, pct: Math.round((completed / planned) * 100) };
    }
  }

  const sleep = summarizeSleepNights(input.sleep, start, today);
  const checkins = summarizeCheckins(input.checkins, start, today);

  // ---- findings (fixed rules)
  const findings: Finding[] = [];
  const thin = inWin.length < MIN_SESSIONS;
  if (thin) {
    findings.push({ id: "insufficient_data", evidence: `${inWin.length} session${inWin.length === 1 ? "" : "s"} with ${name} in the last ${weeks} weeks; at least ${MIN_SESSIONS} are needed before judging a trend.` });
  } else {
    if (e1rmPr && inWin.length >= PLATEAU_MIN_SESSIONS && e1rmPr.daysSince >= PLATEAU_DAYS && e1rmPr.sessionsSince >= 2) {
      findings.push({ id: "plateau", evidence: `Best e1RM ${fmt(bestE)} was set on ${e1rmPr.date} (${e1rmPr.daysSince} days ago); ${e1rmPr.sessionsSince} sessions since without beating it.` });
    }
    if (e1rmPr && e1rmPr.daysSince < PLATEAU_DAYS && prevBestE != null) {
      findings.push({ id: "progressing", evidence: `New best e1RM ${fmt(bestE)} on ${e1rmPr.date}, up from ${fmt(prevBestE)}.` });
    }
    if (weeksCovered >= 2 && inWin.length / weeksCovered < 1) {
      findings.push({ id: "low_frequency", evidence: `${inWin.length} sessions over ${weeksCovered} weeks (${r1(inWin.length / weeksCovered)} per week).` });
    }
    if (setsChange != null && Math.abs(setsChange) > VOLUME_CHANGE_PCT) {
      findings.push({
        id: setsChange < 0 ? "volume_dropped" : "volume_rose",
        evidence: `Hard sets per week: ${r1(priorSetsPerWeek)} in the 4 weeks before → ${r1(recentSetsPerWeek)} in the last 4 weeks (${setsChange > 0 ? "+" : ""}${setsChange}%).`,
      });
    }
    if (program && program.planned_sessions >= 3 && program.pct < CONSISTENCY_MIN_PCT) {
      findings.push({ id: "inconsistent", evidence: `${program.completed_sessions} of ${program.planned_sessions} planned ${program.name} sessions since ${program.from} (${program.pct}%).` });
    }
    if (sameLoadOut && sameLoadOut.prior_sets >= 2 && sameLoadOut.recent_sets >= 2 && (sameLoadOut.change ?? 0) >= RPE_RISE) {
      findings.push({
        id: "rpe_rising_at_same_load",
        evidence: `At ${sameLoadOut.load} ${unit} × ${sameLoadOut.reps}: average RPE ${sameLoadOut.prior_4_weeks_avg_rpe} (${sameLoadOut.prior_sets} sets, 4 weeks before) → ${sameLoadOut.last_4_weeks_avg_rpe} (${sameLoadOut.recent_sets} sets, last 4 weeks).`,
      });
    }
    if (gapWeeks.length >= 2) findings.push({ id: "gap_weeks", evidence: `${gapWeeks.length} of ${weeksCovered} weeks had no ${name} session (weeks starting ${gapWeeks.join(", ")}).` });
    if (sleep && sleep.nights >= SHORT_SLEEP_MIN_NIGHTS && sleep.avg_asleep_hours != null && sleep.avg_asleep_hours * 60 < SHORT_SLEEP_MINUTES) {
      findings.push({ id: "short_sleep", evidence: `Average ${sleep.avg_asleep_hours} h asleep over ${sleep.nights} logged nights in this window${sleep.in_bed_only_nights ? ` (${sleep.in_bed_only_nights} are time in bed only)` : ""}.` });
    }
  }

  // ---- most useful missing data, most useful first
  const missing: string[] = [];
  if (thin) missing.push(`fewer than ${MIN_SESSIONS} ${name} sessions in the last ${weeks} weeks`);
  if (inWin.length && !inWin.some((s) => s.e1rm != null)) missing.push("no sets with a load and 1–12 reps, so no e1RM");
  if (inWin.length && !winRpes.length) missing.push(`no RPE logged for ${name}`);
  if (input.sleep == null) missing.push("no sleep data (sleep logging isn't switched on)");
  else if (!sleep?.nights) missing.push("no sleep logged in this window");
  if (!checkins) missing.push("no recovery check-ins in this window");
  if (!input.program) missing.push("no active program, so attendance against a plan can't be checked");

  return {
    exercise: name,
    slug: exercise.slug,
    unit,
    window: { weeks, start, end: today, weeks_with_this_lift: weeksCovered },
    sessions_in_window: inWin.length,
    sessions_total: all.length,
    weekly,
    e1rm: thin
      ? null
      : {
          window_first: firstEW ? { week_start: firstEW.week_start, value: firstEW.best_e1rm } : null,
          window_last: lastEW && lastEW !== firstEW ? { week_start: lastEW.week_start, value: lastEW.best_e1rm } : null,
          window_change_pct: firstEW && lastEW && lastEW !== firstEW ? pctChange(firstEW.best_e1rm!, lastEW.best_e1rm!) : null,
          last_4_weeks_best: recentE == null ? null : w(recentE),
          last_4_weeks_sessions: recent.length,
          prior_4_weeks_best: priorE == null ? null : w(priorE),
          prior_4_weeks_sessions: prior.length,
          change_4w_pct: recentE != null && priorE != null ? pctChange(priorE, recentE) : null,
        },
    frequency: { sessions_per_week: weeksCovered ? r1(inWin.length / weeksCovered) : null, weeks: weeksCovered, sessions: inWin.length },
    hard_sets_per_week: {
      window_avg: weeksCovered ? r1(hard(inWin) / weeksCovered) : null,
      last_4_weeks_avg: thin ? null : r1(recentSetsPerWeek),
      prior_4_weeks_avg: thin ? null : r1(priorSetsPerWeek),
      prior_weeks_counted: priorWeeks,
      change_pct: thin ? null : setsChange,
      definition: `completed, non-warm-up sets; a set logged below RPE ${HARD_SET_MIN_RPE} is not counted`,
    },
    rpe: {
      window_avg: r1(mean(winRpes)),
      sets_with_rpe: winRpes.length,
      last_4_weeks_avg: thin ? null : r1(mean(rpeOf(recent))),
      last_4_weeks_sets: rpeOf(recent).length,
      prior_4_weeks_avg: thin ? null : r1(mean(rpeOf(prior))),
      prior_4_weeks_sets: rpeOf(prior).length,
      same_load: thin ? null : sameLoadOut,
    },
    records: {
      best_e1rm: bestEIdx >= 0 ? w(bestE) : null,
      best_e1rm_date: e1rmPr?.date ?? null,
      sessions_since_e1rm_pr: e1rmPr?.sessionsSince ?? null,
      days_since_e1rm_pr: e1rmPr?.daysSince ?? null,
      heaviest_set: bestWIdx >= 0 ? w(bestW) : null,
      heaviest_set_date: weightPr?.date ?? null,
      sessions_since_weight_pr: weightPr?.sessionsSince ?? null,
    },
    gap_weeks: gapWeeks,
    program_consistency: program,
    recovery: { sleep, checkins },
    findings,
    missing,
    rules:
      "e1RM is Epley from the best loaded set of 1–12 reps. Findings come from fixed rules on these numbers; explain only what is listed and quote the evidence. Don't claim a trend that isn't listed, and don't extrapolate. If insufficient_data or missing items appear, ask for the single most useful missing piece.",
  };
}

export type LiftAnalysis = ReturnType<typeof analyzeLiftProgress>;
