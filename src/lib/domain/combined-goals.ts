/**
 * Combined goals (SPEC §4): strength or muscle building plus running or conditioning on one coordinated week.
 *
 * The strength days come from the strength/bodybuilding builder and the run days from the existing endurance
 * templates (the "Cardiovascular" builder: first 5K or endurance). This module only decides which weekday each
 * session goes on. The rule: a hard run (intervals, a 5K test) is never on the same day as, or the day before
 * or after, a heavy leg day. Sessions are one per day, strength days are spread out and the long run goes on
 * the weekend when it can. Everything is deterministic.
 */
import type { ProgramDaySeed } from "@/data/programs";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const COMBINE_GOALS = ["5k", "conditioning"] as const;
export type CombineGoal = (typeof COMBINE_GOALS)[number];
export const COMBINE_LABELS: Record<CombineGoal, string> = { "5k": "Run a 5K", conditioning: "Conditioning (intervals)" };

export interface CombineOption {
  goal: CombineGoal;
  /** Run / conditioning sessions per week (2–3). */
  days: number;
}

/** Exercises that make a day a hard run or conditioning session. */
const HARD_CARDIO = new Set(["running-intervals", "bike-intervals", "rowing-intervals", "stair-climb", "air-bike-sprint"]);
const LEG_PATTERNS = new Set(["squat", "hinge", "lunge"]);

export interface PatternLookup {
  (slug: string): { pattern: string; category: string } | undefined;
}

/** Hard leg sets in a day: squat, hinge and lunge strength exercises (bodyweight bridges and carries don't count). */
export function legLoad(day: ProgramDaySeed, lookup: PatternLookup): number {
  return day.exercises.reduce((s, e) => {
    const x = lookup(e.ex);
    return x && x.category === "strength" && LEG_PATTERNS.has(x.pattern) && e.reps ? s + e.sets : s;
  }, 0);
}

export function isHardRun(day: ProgramDaySeed): boolean {
  return day.exercises.some((e) => HARD_CARDIO.has(e.ex) || /5K day/.test(e.notes ?? ""));
}

export function isLongRun(day: ProgramDaySeed): boolean {
  return /long/i.test(day.name);
}

const dist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 7;
  return Math.min(d, 7 - d);
};

function* combinations(n: number, k: number, start = 0, acc: number[] = []): Generator<number[]> {
  if (acc.length === k) {
    yield [...acc];
    return;
  }
  for (let i = start; i < n; i++) {
    acc.push(i);
    yield* combinations(n, k, i + 1, acc);
    acc.pop();
  }
}

export interface ScheduledDay {
  weekday: number;
  kind: "strength" | "run";
  /** Index in the source list (strength days or run days). */
  index: number;
}

/**
 * Place strength days (in their order) and run days (in their order) on weekdays 0–6, one session per day.
 * `heavy[i]` marks heavy leg days and `hard[j]` hard runs. Returns null when no placement keeps every hard run
 * at least two days from every heavy leg day with no two heavy leg days back to back.
 */
export function scheduleCombinedWeek(heavy: boolean[], hard: boolean[], long: boolean[]): ScheduledDay[] | null {
  const s = heavy.length;
  const r = hard.length;
  if (s + r > 7) return null;
  let best: { score: number; plan: ScheduledDay[] } | null = null;
  for (const sDays of combinations(7, s)) {
    const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !sDays.includes(d));
    for (const rDays of combinations(free.length, r)) {
      const runs = rDays.map((i) => free[i]!);
      let ok = true;
      for (let j = 0; j < r && ok; j++) {
        if (!hard[j]) continue;
        for (let i = 0; i < s; i++) if (heavy[i] && dist(runs[j]!, sDays[i]!) < 2) ok = false;
      }
      // Heavy leg days are never back to back either (Sunday → Monday included).
      for (let i = 0; i < s && ok; i++) for (let k = i + 1; k < s && ok; k++) if (heavy[i] && heavy[k] && dist(sDays[i]!, sDays[k]!) < 2) ok = false;
      if (!ok) continue;
      // Lower is better: back-to-back strength days, back-to-back hard sessions, a long run off the weekend,
      // and a week that doesn't start on Monday.
      let score = 0;
      const all = [...sDays].sort((a, b) => a - b);
      for (let k = 1; k < all.length; k++) if (all[k]! - all[k - 1]! === 1) score += 3;
      const hardDays = [...sDays.filter((_, i) => heavy[i]), ...runs.filter((_, j) => hard[j])].sort((a, b) => a - b);
      for (let k = 1; k < hardDays.length; k++) if (hardDays[k]! - hardDays[k - 1]! === 1) score += 4;
      for (let j = 0; j < r; j++) if (long[j] && runs[j]! < 5) score += 2;
      if (Math.min(...sDays, ...runs) !== 0) score += 1;
      if (!best || score < best.score) {
        best = {
          score,
          plan: [...sDays.map((weekday, index) => ({ weekday, kind: "strength" as const, index })), ...runs.map((weekday, index) => ({ weekday, kind: "run" as const, index }))].sort(
            (a, b) => a.weekday - b.weekday,
          ),
        };
      }
    }
  }
  return best?.plan ?? null;
}

const MODERATE_NOTE = "Combined plan: keep squats, hinges and lunges at RPE 7 or below today — a hard run is within a day.";

/**
 * One coordinated week: strength days and run days on weekdays, with weekday-prefixed names. When the strength
 * program has so many heavy leg days that no placement works (e.g. three heavy full-body days and an interval
 * day), the lightest heavy day is made moderate (leg RPE ≤ 7, with a note) until one does.
 */
export function combineWeek(strength: ProgramDaySeed[], runs: ProgramDaySeed[], lookup: PatternLookup): ProgramDaySeed[] {
  const loads = strength.map((d) => legLoad(d, lookup));
  const max = Math.max(0, ...loads);
  const heavy = loads.map((l) => l >= 4 && l >= max * 0.6);
  const hard = runs.map(isHardRun);
  const long = runs.map(isLongRun);
  let plan = scheduleCombinedWeek(heavy, hard, long);
  const moderated = new Set<number>();
  while (!plan) {
    const candidates = heavy.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
    if (!candidates.length) break;
    const lightest = candidates.reduce((a, b) => (loads[b]! < loads[a]! ? b : a));
    heavy[lightest] = false;
    moderated.add(lightest);
    plan = scheduleCombinedWeek(heavy, hard, long);
  }
  if (!plan) throw new Error("Can't schedule a combined week with this many sessions");
  return plan.map((slot) => {
    const src = slot.kind === "strength" ? strength[slot.index]! : runs[slot.index]!;
    const day: ProgramDaySeed = { ...src, name: `${WEEKDAYS[slot.weekday]} · ${src.name}`.slice(0, 120) };
    if (slot.kind === "strength" && moderated.has(slot.index)) {
      day.exercises = src.exercises.map((e) => {
        const x = lookup(e.ex);
        if (!x || !LEG_PATTERNS.has(x.pattern) || !e.reps) return e;
        const out = { ...e, notes: [e.notes, MODERATE_NOTE].filter(Boolean).join(" ").slice(0, 500) };
        if (out.rpe !== undefined) out.rpe = Math.min(out.rpe, 7);
        return out;
      });
    }
    return day;
  });
}

/** Weekday index from a combined day's name ("Thu · Intervals" → 3), or null. */
export function weekdayOf(name: string): number | null {
  const i = WEEKDAYS.findIndex((d) => name.startsWith(`${d} · `));
  return i < 0 ? null : i;
}
