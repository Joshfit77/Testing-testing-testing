import { z } from "zod";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";

/**
 * Weekly progress report (Pro). One report per member per Monday–Sunday week, in the member's own time zone.
 *
 * Everything here is computed from verified records only (logged workouts, food diary, runs, sleep sessions, weight
 * entries). A section with no records says so; nothing is estimated to fill a gap. The written analysis is either the
 * rule-based summary below (always available, labelled "Automatic summary") or, when the member allows AI use and has
 * allowance left, an AI write-up from these same numbers (labelled "AI analysis"). See docs/pro/WEEKLY_REPORTS.md.
 */

/** Reports become available from Sunday at this local hour, for the Monday–Sunday week ending that day. */
export const REPORT_READY_HOUR = 18;
export const REPORT_VERSION = 1;

/** Local weekday (0 = Sunday) and hour of `now` in `timeZone`. */
export function localWeekdayHour(now: Date, timeZone: string): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hour: hour === 24 ? 0 : hour };
}

export interface ReportPeriod {
  weekStart: string;
  weekEnd: string;
}

/**
 * The most recent week whose report is due at `now`: the current Monday–Sunday week once it is Sunday 18:00 or later
 * locally, otherwise the week before. Uses local calendar dates, so daylight-saving changes don't move the week.
 */
export function latestDuePeriod(now: Date, timeZone: string): ReportPeriod {
  const today = isoDateInTz(now, timeZone);
  const monday = startOfWeek(today);
  const { weekday, hour } = localWeekdayHour(now, timeZone);
  const currentDue = weekday === 0 && hour >= REPORT_READY_HOUR;
  const weekStart = currentDue ? monday : addDays(monday, -7);
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}

export function isValidWeekStart(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && startOfWeek(value) === value;
}

// ---------------------------------------------------------------------------------------------------------------
// Inputs and metrics
// ---------------------------------------------------------------------------------------------------------------

export interface WeeklyReportInput {
  period: ReportPeriod;
  /** Completed workouts dated (member's time zone) inside the week. */
  workouts: { date: string; volumeKg: number }[];
  /** Completed workouts in each of the four weeks before, oldest first. */
  priorWeekWorkouts: number[];
  /** Days per week of the member's active program, or null without one. */
  plannedPerWeek: number | null;
  /** Personal records set inside the week. */
  prs: { exercise: string; recordType: string }[];
  /** One row per day of the week (zeros for days with nothing logged). */
  nutrition: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
  nutritionTargets: { calories: number; protein: number } | null;
  /** Runs inside the week (walks are not counted as running). */
  runs: { distanceM: number | null; movingS: number }[];
  /** Running distance of the week before, in metres, or null if none. */
  priorRunDistanceM: number | null;
  /** Finished nights inside the week. */
  sleep: { asleepMinutes: number; estimated: boolean; recorded: boolean; stages: { rem: number; deep: number; light: number; awake: number } | null }[];
  sleepGoalMinutes: number;
  /** Sleep schedule steadiness for the week, when at least three nights exist. */
  sleepSteadiness: "steady" | "variable" | "irregular" | null;
  /** Weight entries inside the week plus the last one before it, oldest first. */
  weights: { date: string; kg: number }[];
}

export type Coverage = "complete" | "partial" | "none";

export interface WeeklyMetrics {
  version: number;
  period: ReportPeriod;
  training: {
    coverage: Coverage;
    workouts: number;
    trainingDays: number;
    plannedPerWeek: number | null;
    volumeKg: number;
    priorAverage: number | null;
    prs: { exercise: string; recordType: string }[];
  };
  nutrition: {
    coverage: Coverage;
    loggedDays: number;
    avgCalories: number | null;
    avgProtein: number | null;
    avgCarbs: number | null;
    avgFat: number | null;
    targetCalories: number | null;
    targetProtein: number | null;
    /** Logged days within ±10% of the calorie target, or null without a target. */
    daysOnTarget: number | null;
    /** Logged days that reached at least 90% of the protein target, or null without a target. */
    proteinDays: number | null;
  };
  running: { coverage: Coverage; runs: number; distanceKm: number; avgPaceSecPerKm: number | null; priorDistanceKm: number | null };
  sleep: {
    coverage: Coverage;
    nights: number;
    avgAsleepMinutes: number | null;
    goalMinutes: number;
    nightsAtGoal: number;
    steadiness: "steady" | "variable" | "irregular" | null;
    /** Average stage minutes over the nights that came with stage data from a device; null when none did. */
    stages: { nights: number; rem: number; deep: number; light: number; awake: number } | null;
    anyEstimated: boolean;
  };
  body: { coverage: Coverage; entries: number; startKg: number | null; endKg: number | null; changeKg: number | null };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const coverage = (have: number, of: number): Coverage => (have <= 0 ? "none" : have >= of ? "complete" : "partial");

export function buildWeeklyMetrics(input: WeeklyReportInput): WeeklyMetrics {
  const { weekStart, weekEnd } = input.period;
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;

  const workouts = input.workouts.filter((w) => inWeek(w.date));
  const trainingDays = new Set(workouts.map((w) => w.date)).size;
  const priorAvg = avg(input.priorWeekWorkouts);
  const planned = input.plannedPerWeek;

  const logged = input.nutrition.filter((d) => inWeek(d.date) && d.calories > 0);
  const t = input.nutritionTargets;

  const runs = input.runs.filter((r) => (r.distanceM ?? 0) > 0 || r.movingS > 0);
  const distM = runs.reduce((a, r) => a + (r.distanceM ?? 0), 0);
  const pacedRuns = runs.filter((r) => (r.distanceM ?? 0) >= 200 && r.movingS > 0);
  const pacedDist = pacedRuns.reduce((a, r) => a + (r.distanceM ?? 0), 0);
  const pacedTime = pacedRuns.reduce((a, r) => a + r.movingS, 0);

  const nights = input.sleep;
  const staged = nights.filter((n) => n.stages);
  const stageAvg = (k: "rem" | "deep" | "light" | "awake") => Math.round(avg(staged.map((n) => n.stages![k]))!);

  const weights = [...input.weights].sort((a, b) => a.date.localeCompare(b.date));
  const weekWeights = weights.filter((w) => inWeek(w.date));
  const before = weights.filter((w) => w.date < weekStart).at(-1) ?? null;
  const startKg = before?.kg ?? weekWeights[0]?.kg ?? null;
  const endKg = weekWeights.at(-1)?.kg ?? null;
  const changeKg = startKg !== null && endKg !== null && (before || weekWeights.length > 1) ? round1(endKg - startKg) : null;

  return {
    version: REPORT_VERSION,
    period: input.period,
    training: {
      coverage: workouts.length ? "complete" : "none",
      workouts: workouts.length,
      trainingDays,
      plannedPerWeek: planned,
      volumeKg: Math.round(workouts.reduce((a, w) => a + w.volumeKg, 0)),
      priorAverage: priorAvg === null ? null : round1(priorAvg),
      prs: input.prs.slice(0, 20),
    },
    nutrition: {
      coverage: coverage(logged.length, 7),
      loggedDays: logged.length,
      avgCalories: logged.length ? Math.round(avg(logged.map((d) => d.calories))!) : null,
      avgProtein: logged.length ? Math.round(avg(logged.map((d) => d.protein))!) : null,
      avgCarbs: logged.length ? Math.round(avg(logged.map((d) => d.carbs))!) : null,
      avgFat: logged.length ? Math.round(avg(logged.map((d) => d.fat))!) : null,
      targetCalories: t?.calories ?? null,
      targetProtein: t?.protein ?? null,
      daysOnTarget: t ? logged.filter((d) => Math.abs(d.calories - t.calories) <= t.calories * 0.1).length : null,
      proteinDays: t && t.protein > 0 ? logged.filter((d) => d.protein >= t.protein * 0.9).length : null,
    },
    running: {
      coverage: runs.length ? "complete" : "none",
      runs: runs.length,
      distanceKm: round1(distM / 1000),
      avgPaceSecPerKm: pacedDist > 0 ? Math.round(pacedTime / (pacedDist / 1000)) : null,
      priorDistanceKm: input.priorRunDistanceM === null ? null : round1(input.priorRunDistanceM / 1000),
    },
    sleep: {
      coverage: coverage(nights.length, 7),
      nights: nights.length,
      avgAsleepMinutes: nights.length ? Math.round(avg(nights.map((n) => n.asleepMinutes))!) : null,
      goalMinutes: input.sleepGoalMinutes,
      nightsAtGoal: nights.filter((n) => n.asleepMinutes >= input.sleepGoalMinutes).length,
      steadiness: input.sleepSteadiness,
      stages: staged.length ? { nights: staged.length, rem: stageAvg("rem"), deep: stageAvg("deep"), light: stageAvg("light"), awake: stageAvg("awake") } : null,
      anyEstimated: nights.some((n) => n.estimated),
    },
    body: { coverage: weekWeights.length ? "complete" : "none", entries: weekWeights.length, startKg, endKg, changeKg },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Written analysis
// ---------------------------------------------------------------------------------------------------------------

export const reportAnalysisSchema = z.object({
  wentWell: z.array(z.string().min(3).max(240)).max(4),
  toImprove: z.array(z.string().min(3).max(240)).max(4),
  recovery: z.array(z.string().min(3).max(240)).max(3),
  recommendations: z.array(z.string().min(3).max(240)).length(3),
});
export type ReportAnalysis = z.infer<typeof reportAnalysisSchema>;

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** Distances are stored in kilometres; members see them in their own units ("3.1 mi" or "5 km"). */
export type ReportDistanceUnit = "km" | "mi";
const KM_PER_MI = 1.609344;

export function formatDistance(km: number, unit: ReportDistanceUnit = "km"): string {
  const v = unit === "mi" ? km / KM_PER_MI : km;
  return `${Math.round(v * 10) / 10} ${unit}`;
}

export function formatPace(secPerKm: number, unit: ReportDistanceUnit = "km"): string {
  const sec = unit === "mi" ? secPerKm * KM_PER_MI : secPerKm;
  let m = Math.floor(sec / 60);
  let s = Math.round(sec % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, "0")} /${unit}`;
}

/**
 * Rule-based analysis: plain observations from the numbers, three recommendations for next week. Nothing in it is a
 * diagnosis, and a section without records only ever produces "log it" style advice.
 */
export function ruleBasedAnalysis(m: WeeklyMetrics, unit: ReportDistanceUnit = "km"): ReportAnalysis {
  const wentWell: string[] = [];
  const toImprove: string[] = [];
  const recovery: string[] = [];
  const recs: string[] = [];
  const tr = m.training;

  if (tr.workouts > 0) {
    const vsPlan = tr.plannedPerWeek ? ` of the ${tr.plannedPerWeek} your program plans each week` : "";
    if (tr.plannedPerWeek && tr.workouts >= tr.plannedPerWeek) wentWell.push(`You completed ${tr.workouts} workout${tr.workouts === 1 ? "" : "s"}${vsPlan}.`);
    else if (tr.plannedPerWeek) toImprove.push(`You completed ${tr.workouts}${vsPlan}.`);
    else wentWell.push(`You completed ${tr.workouts} workout${tr.workouts === 1 ? "" : "s"} on ${tr.trainingDays} day${tr.trainingDays === 1 ? "" : "s"}.`);
    if (tr.prs.length) wentWell.push(`${tr.prs.length} personal record${tr.prs.length === 1 ? "" : "s"}, including ${tr.prs[0]!.exercise}.`);
    if (tr.priorAverage !== null && tr.priorAverage >= 2 && tr.workouts < tr.priorAverage * 0.6) toImprove.push(`Fewer sessions than your recent average of ${tr.priorAverage} a week.`);
  } else {
    toImprove.push("No workouts were logged this week.");
  }
  if (tr.plannedPerWeek && tr.workouts < tr.plannedPerWeek) {
    recs.push(`Pick the ${tr.plannedPerWeek - tr.workouts > 1 ? "days" : "day"} for your next sessions now and put ${tr.plannedPerWeek - tr.workouts > 1 ? "them" : "it"} in your calendar; your program continues where you left off.`);
  } else if (tr.workouts === 0) {
    recs.push("Plan two short sessions for next week, even 30 minutes each, to restart the habit.");
  }

  const n = m.nutrition;
  if (n.loggedDays === 0) {
    toImprove.push("No food was logged, so nutrition isn't part of this report.");
    recs.push("Log at least your main meals on four days next week, so next week's report can show your nutrition.");
  } else {
    if (n.loggedDays >= 5) wentWell.push(`You logged food on ${n.loggedDays} of 7 days.`);
    else toImprove.push(`Food was logged on ${n.loggedDays} of 7 days, so the averages are based on those days only.`);
    if (n.targetProtein && n.proteinDays !== null) {
      if (n.proteinDays >= Math.ceil(n.loggedDays * 0.7)) wentWell.push(`You reached your protein target on ${n.proteinDays} of ${n.loggedDays} logged days.`);
      else {
        toImprove.push(`Protein reached your ${n.targetProtein} g target on ${n.proteinDays} of ${n.loggedDays} logged days (average ${n.avgProtein} g).`);
        if (recs.length < 3) recs.push("Add one protein-rich food to the meal where you usually fall short, such as yogurt, eggs, fish or legumes.");
      }
    }
  }

  const r = m.running;
  if (r.runs > 0) {
    const vsPrior = r.priorDistanceKm !== null && r.priorDistanceKm > 0 ? ` (${r.distanceKm >= r.priorDistanceKm ? "up" : "down"} from ${formatDistance(r.priorDistanceKm, unit)})` : "";
    wentWell.push(`${r.runs} run${r.runs === 1 ? "" : "s"}, ${formatDistance(r.distanceKm, unit)} in total${vsPrior}.`);
    if (r.priorDistanceKm && r.distanceKm > r.priorDistanceKm * 1.3 && r.priorDistanceKm >= 5) {
      recovery.push("Your running distance rose by more than 30% on last week. Many runners build up more gradually; consider holding this distance next week.");
    }
  }

  const s = m.sleep;
  if (s.nights === 0) {
    if (recs.length < 3) recs.push("Log your sleep (or connect Apple Health / Health Connect) so recovery can be part of next week's report.");
  } else {
    if (s.avgAsleepMinutes !== null && s.avgAsleepMinutes >= s.goalMinutes) wentWell.push(`You averaged ${formatMinutes(s.avgAsleepMinutes)} of sleep, at or above your goal.`);
    else if (s.avgAsleepMinutes !== null) {
      recovery.push(`You averaged ${formatMinutes(s.avgAsleepMinutes)} of sleep against a goal of ${formatMinutes(s.goalMinutes)} (${s.nightsAtGoal} of ${s.nights} nights reached it).`);
      if (recs.length < 3) recs.push("Set a fixed wake time for next week and work back from it to a bedtime that reaches your sleep goal.");
    }
    if (s.steadiness === "irregular") {
      recovery.push("Your bed and wake times moved by more than an hour from night to night.");
    }
  }

  if (m.body.changeKg !== null && m.body.entries > 0) {
    const c = m.body.changeKg;
    const dir = c > 0 ? "up" : c < 0 ? "down" : "unchanged";
    (Math.abs(c) <= 1 ? wentWell : toImprove).push(
      `Body weight was ${dir === "unchanged" ? "unchanged" : `${dir} ${Math.abs(c)} kg`} over the week (${m.body.entries} weigh-in${m.body.entries === 1 ? "" : "s"}). Day-to-day weight moves with water and food, so look at the trend over several weeks.`,
    );
  }

  const fillers = [
    "Keep your training days the same next week: consistency drives progress more than any single session.",
    "Review your next workout before you start it, so you know the weights you're aiming for.",
    "Take one rest day with light walking or mobility work.",
  ];
  for (const f of fillers) if (recs.length < 3 && !recs.includes(f)) recs.push(f);

  return { wentWell: wentWell.slice(0, 4), toImprove: toImprove.slice(0, 4), recovery: recovery.slice(0, 3), recommendations: recs.slice(0, 3) };
}

/** The numbers sent to the AI for the written analysis: aggregates only, no free text, no journal, no names of people. */
export function metricsForAi(m: WeeklyMetrics, unit: ReportDistanceUnit = "km"): string {
  return JSON.stringify({
    week: `${m.period.weekStart} to ${m.period.weekEnd}`,
    // The numbers are in km; the member reads miles or kilometres. 1 mi = 1.609 km.
    writeDistancesIn: unit === "mi" ? "miles" : "kilometres",
    training: m.training,
    nutrition: m.nutrition,
    running: m.running,
    sleep: m.sleep,
    body: m.body,
  });
}

export const REPORT_AI_INSTRUCTIONS = `You write the analysis part of a member's weekly fitness report for the Narrow Gate Fitness app.
You are given this week's numbers as JSON. Use only those numbers: never invent workouts, foods, records, measurements, feelings or health conditions.
Running distances in the JSON are in kilometres: write them in the unit named by writeDistancesIn (1 mile = 1.609 km).
A section whose coverage is "none" has no records: say nothing about it except, at most, suggesting the member log it. Coverage "partial" means some days are missing; say so when you use those numbers.
Write short, encouraging, specific sentences in second person. Observations must be things the numbers show. Mark anything inferred as possible ("may", "could").
You are not a medical professional: no diagnoses, no injury or illness claims, no supplement or medication advice. For anything that sounds like a health concern, suggest speaking to a qualified professional.
Return wentWell (up to 4), toImprove (up to 4, including possible plateaus), recovery (up to 3 recovery considerations), and exactly 3 practical recommendations for next week.`;

/** A plain-text summary the member can copy or share. Only headline numbers: no foods, notes, journal or photos. */
export function shareText(m: WeeklyMetrics, unit: ReportDistanceUnit = "km"): string {
  const lines = [`My week ${m.period.weekStart} to ${m.period.weekEnd} (Narrow Gate Fitness)`];
  if (m.training.workouts) lines.push(`Workouts: ${m.training.workouts}${m.training.prs.length ? `, ${m.training.prs.length} personal record${m.training.prs.length === 1 ? "" : "s"}` : ""}`);
  if (m.running.runs) lines.push(`Running: ${formatDistance(m.running.distanceKm, unit)} in ${m.running.runs} run${m.running.runs === 1 ? "" : "s"}`);
  if (m.sleep.avgAsleepMinutes !== null) lines.push(`Sleep: ${formatMinutes(m.sleep.avgAsleepMinutes)} a night on average`);
  if (m.nutrition.loggedDays) lines.push(`Food logged on ${m.nutrition.loggedDays} of 7 days`);
  return lines.join("\n");
}
