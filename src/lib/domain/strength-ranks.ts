import { BODY_REGIONS, BODY_REGION_LABELS, type BodyRegion } from "./body-regions";
import { estimateOneRepMax } from "./strength";

/**
 * Strength ranks per body region: Bronze → Silver → Gold → Platinum → Diamond → Disciple.
 *
 * These are PROVISIONAL APP RULES, not validated strength standards. They are written down here in full so the
 * member can see exactly how a rank is reached, and so they can be tuned in one place (`RULES_VERSION` changes
 * when they do). The thresholds were set by hand to sit roughly where common strength-level tables put
 * "beginner" to "elite" for each lift; nothing has been calibrated against a population.
 *
 * Fairness rules:
 *   - Every lift is compared only with its own table. A leg press is never treated as a squat, a machine is never
 *     treated as a barbell, and a dumbbell lift isn't ranked at all, because the app doesn't record whether a
 *     dumbbell load was logged per hand or in total.
 *   - Barbell lifts use the estimated one-rep max (Epley, from sets of 1–12 reps) divided by body weight.
 *     Pull-ups, chin-ups and dips count body weight plus any added weight. Push-ups, rollouts and hangs use reps or
 *     seconds, so they don't need a body weight.
 *   - A region's rank is its best single benchmark lift (the "representative" lift). Logging more sets, more
 *     sessions or more similar exercises can't raise it; only a better performance on a benchmark can.
 *   - Only completed working sets from the last 12 months count, so a rank reflects current strength.
 *   - Implausible values (far beyond the top of a table, usually a typo) are ignored and reported.
 *   - Nothing here looks at photos, and these ranks are separate from the 27 milestone badges.
 *   - Men's and women's tables differ; the member chooses which one to compare with.
 */

export const RULES_VERSION = "Provisional rules v1 (October 2026)";

export const STRENGTH_RANKS = ["bronze", "silver", "gold", "platinum", "diamond", "disciple"] as const;
export type StrengthRank = (typeof STRENGTH_RANKS)[number];
export const STRENGTH_RANK_LABELS: Record<StrengthRank, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  disciple: "Disciple",
};

export type StandardsTable = "men" | "women";
export const STANDARDS_LABELS: Record<StandardsTable, string> = { men: "Men's table", women: "Women's table" };

/**
 *   - `load_ratio`: estimated 1RM ÷ body weight, from the logged load.
 *   - `bodyweight_ratio`: (body weight + added weight) as an estimated 1RM ÷ body weight; 1 rep with no added
 *     weight is 1.0, 10 reps is about 1.33. Sets over 12 reps count as 12.
 *   - `reps`: most reps in one working set with no added weight.
 *   - `seconds`: longest hold in one set.
 */
export type Measure = "load_ratio" | "bodyweight_ratio" | "reps" | "seconds";

/** Thresholds for Bronze, Silver, Gold, Platinum, Diamond and Disciple, in the measure's unit. */
type Thresholds = readonly [number, number, number, number, number, number];

export interface Benchmark {
  slug: string;
  name: string;
  measure: Measure;
  men: Thresholds;
  women: Thresholds;
}

const B = (slug: string, name: string, measure: Measure, men: Thresholds, women: Thresholds): Benchmark => ({ slug, name, measure, men, women });

const BENCH = B("bench-press", "Barbell Bench Press", "load_ratio", [0.5, 0.75, 1.0, 1.25, 1.5, 1.75], [0.25, 0.4, 0.6, 0.8, 1.0, 1.2]);
const SQUAT = B("back-squat", "Barbell Back Squat", "load_ratio", [0.75, 1.0, 1.25, 1.5, 2.0, 2.4], [0.5, 0.7, 0.9, 1.15, 1.4, 1.75]);
const DEADLIFT = B("conventional-deadlift", "Conventional Deadlift", "load_ratio", [1.0, 1.25, 1.5, 2.0, 2.5, 2.9], [0.6, 0.85, 1.1, 1.4, 1.75, 2.1]);
const PULL_UP = B("pull-up", "Pull-Up", "bodyweight_ratio", [1.0, 1.17, 1.33, 1.5, 1.7, 1.9], [1.0, 1.07, 1.17, 1.33, 1.5, 1.65]);
const CHIN_UP = B("chin-up", "Chin-Up", "bodyweight_ratio", [1.0, 1.17, 1.33, 1.5, 1.7, 1.9], [1.0, 1.07, 1.17, 1.33, 1.5, 1.65]);
const DIPS = B("dips", "Dips", "bodyweight_ratio", [1.0, 1.17, 1.33, 1.55, 1.8, 2.0], [1.0, 1.07, 1.2, 1.35, 1.55, 1.75]);

/** Benchmark lifts per region. A lift can rank more than one region; it still counts once within each. */
export const REGION_BENCHMARKS: Record<BodyRegion, Benchmark[]> = {
  chest: [BENCH, DIPS, B("push-up", "Push-Up", "reps", [1, 10, 20, 35, 50, 70], [1, 5, 12, 22, 35, 50])],
  upper_back: [PULL_UP, CHIN_UP, B("barbell-row", "Barbell Row", "load_ratio", [0.5, 0.65, 0.85, 1.05, 1.25, 1.5], [0.3, 0.4, 0.55, 0.7, 0.85, 1.0])],
  lower_back: [DEADLIFT],
  shoulders: [B("overhead-press", "Overhead Press", "load_ratio", [0.35, 0.5, 0.65, 0.8, 1.0, 1.15], [0.2, 0.3, 0.4, 0.5, 0.65, 0.8])],
  biceps: [CHIN_UP],
  triceps: [B("close-grip-bench-press", "Close-Grip Bench Press", "load_ratio", [0.45, 0.65, 0.9, 1.1, 1.35, 1.6], [0.25, 0.35, 0.5, 0.7, 0.9, 1.05]), DIPS],
  forearms: [B("dead-hang", "Dead Hang", "seconds", [10, 30, 45, 60, 90, 120], [10, 20, 35, 50, 75, 100])],
  abdominals: [
    B("ab-wheel-rollout", "Ab Wheel Rollout", "reps", [1, 5, 10, 15, 20, 30], [1, 3, 6, 10, 15, 20]),
    B("hanging-knee-raise", "Hanging Knee Raise", "reps", [5, 10, 15, 20, 25, 30], [3, 8, 12, 16, 20, 25]),
  ],
  glutes: [B("hip-thrust", "Barbell Hip Thrust", "load_ratio", [0.75, 1.0, 1.5, 2.0, 2.5, 3.0], [0.5, 0.8, 1.2, 1.6, 2.0, 2.5]), SQUAT],
  quadriceps: [SQUAT, B("front-squat", "Barbell Front Squat", "load_ratio", [0.6, 0.85, 1.05, 1.3, 1.6, 1.9], [0.4, 0.55, 0.75, 0.95, 1.2, 1.45])],
  hamstrings: [DEADLIFT, B("nordic-hamstring-curl", "Nordic Hamstring Curl", "reps", [1, 3, 5, 8, 12, 15], [1, 2, 4, 6, 9, 12])],
  calves: [],
};

/** Why a region has no benchmark at all. */
export const NO_BENCHMARK_REASON: Partial<Record<BodyRegion, string>> = {
  calves: "No provisional rule yet: calf raises are logged with body weight, dumbbells or machines under one exercise, so their loads can't be compared fairly.",
};

/** Values above the top threshold × this factor are treated as typos. */
const IMPLAUSIBLE_FACTOR = 1.6;
const WINDOW_DAYS = 365;

export interface RankSet {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  completed: boolean;
  isWarmup: boolean;
}

export interface RankSession {
  /** Session id: a set is counted once however many times it's loaded. */
  id: string;
  date: string;
  exercises: { slug: string; sets: RankSet[] }[];
}

export interface BenchmarkResult {
  benchmark: Benchmark;
  /** Best value in the window, in the measure's unit, or null when there's no qualifying set. */
  value: number | null;
  date: string | null;
  /** The set behind the best value, for display ("100 kg × 5"). */
  best: { weightKg: number | null; reps: number | null; seconds: number | null } | null;
  /** 0 = below Bronze, 1 = Bronze … 6 = Disciple; null when not assessed. */
  level: number | null;
  /** 0–1 progress from the current threshold to the next one (1 at Disciple). */
  progress: number | null;
  notAssessed: string | null;
  ignoredImplausible: number;
}

export interface RegionRank {
  region: BodyRegion;
  label: string;
  /** null = not assessed. */
  level: number | null;
  rank: StrengthRank | null;
  progress: number | null;
  /** The benchmark that sets the rank. */
  representative: BenchmarkResult | null;
  benchmarks: BenchmarkResult[];
  notAssessed: string | null;
}

export interface RankInput {
  sessions: RankSession[];
  bodyweightKg: number | null;
  table: StandardsTable | null;
  today: string;
}

function windowStart(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

function measureSet(m: Measure, s: RankSet, bw: number | null): number | null {
  if (!s.completed || s.isWarmup) return null;
  const reps = s.reps ?? 0;
  const added = s.weightKg ?? 0;
  switch (m) {
    case "load_ratio": {
      if (!bw || added <= 0 || reps <= 0) return null;
      const e1 = estimateOneRepMax(added, reps);
      return e1 == null ? null : e1 / bw;
    }
    case "bodyweight_ratio": {
      if (!bw || reps <= 0 || added < 0) return null;
      const e1 = estimateOneRepMax(bw + added, Math.min(reps, 12));
      return e1 == null ? null : e1 / bw;
    }
    case "reps":
      return added > 0 || reps <= 0 ? null : reps;
    case "seconds":
      return s.durationSeconds && s.durationSeconds > 0 ? s.durationSeconds : null;
  }
}

export function levelFor(value: number, t: Thresholds): { level: number; progress: number } {
  let level = 0;
  for (let i = 0; i < t.length; i++) if (value >= t[i]! - 1e-9) level = i + 1;
  if (level >= t.length) return { level, progress: 1 };
  const lo = level === 0 ? 0 : t[level - 1]!;
  const hi = t[level]!;
  return { level, progress: Math.max(0, Math.min(1, (value - lo) / (hi - lo))) };
}

export function needsBodyweight(m: Measure): boolean {
  return m === "load_ratio" || m === "bodyweight_ratio";
}

export function scoreBenchmark(b: Benchmark, input: RankInput): BenchmarkResult {
  const empty = { benchmark: b, value: null, date: null, best: null, level: null, progress: null, ignoredImplausible: 0 };
  if (!input.table) return { ...empty, notAssessed: "Choose the men's or women's table first." };
  const t = b[input.table];
  const from = windowStart(input.today);
  let best: { value: number; date: string; set: RankSet } | null = null;
  let ignored = 0;
  let anySet = false;
  const seen = new Set<string>();
  for (const s of input.sessions) {
    if (s.date < from || s.date > input.today || seen.has(s.id)) continue;
    seen.add(s.id);
    for (const e of s.exercises) {
      if (e.slug !== b.slug) continue;
      for (const set of e.sets) {
        if (!set.completed || set.isWarmup) continue;
        anySet = true;
        const v = measureSet(b.measure, set, input.bodyweightKg);
        if (v == null) continue;
        if (v > t[5] * IMPLAUSIBLE_FACTOR) {
          ignored++;
          continue;
        }
        if (!best || v > best.value) best = { value: v, date: s.date, set };
      }
    }
  }
  if (!best) {
    const reason = !anySet
      ? `No completed working sets of ${b.name} in the last 12 months.`
      : needsBodyweight(b.measure) && !input.bodyweightKg
        ? "Log your body weight so this lift can be compared."
        : b.measure === "reps"
          ? `Only sets with added weight were logged; this rule counts body-weight reps.`
          : `No set of ${b.name} could be scored (for example, reps above 12 or a missing load).`;
    return { ...empty, notAssessed: reason, ignoredImplausible: ignored };
  }
  const { level, progress } = levelFor(best.value, t);
  return {
    benchmark: b,
    value: Math.round(best.value * 100) / 100,
    date: best.date,
    best: { weightKg: best.set.weightKg, reps: best.set.reps, seconds: best.set.durationSeconds },
    level,
    progress,
    notAssessed: null,
    ignoredImplausible: ignored,
  };
}

export function rankRegion(region: BodyRegion, input: RankInput): RegionRank {
  const label = BODY_REGION_LABELS[region];
  const benches = REGION_BENCHMARKS[region];
  if (!benches.length) {
    return { region, label, level: null, rank: null, progress: null, representative: null, benchmarks: [], notAssessed: NO_BENCHMARK_REASON[region] ?? "No provisional rule for this region yet." };
  }
  const results = benches.map((b) => scoreBenchmark(b, input));
  const assessed = results.filter((r) => r.level != null);
  if (!assessed.length) {
    const why = !input.table ? "Choose the men's or women's table first." : `Log one of: ${benches.map((b) => b.name).join(", ")}.`;
    return { region, label, level: null, rank: null, progress: null, representative: null, benchmarks: results, notAssessed: why };
  }
  const rep = assessed.reduce((a, b) => (b.level! > a.level! || (b.level === a.level && b.progress! > a.progress!) ? b : a));
  return {
    region,
    label,
    level: rep.level,
    rank: rep.level! > 0 ? STRENGTH_RANKS[rep.level! - 1]! : null,
    progress: rep.progress,
    representative: rep,
    benchmarks: results,
    notAssessed: null,
  };
}

export interface OverallRank {
  level: number | null;
  rank: StrengthRank | null;
  assessed: number;
  total: number;
  notAssessed: { region: BodyRegion; label: string; reason: string }[];
  explanation: string;
}

/** Minimum assessed regions for an overall rank. */
export const OVERALL_MIN_REGIONS = 4;

/**
 * The overall rank is the middle (median, rounded down) of the assessed regions' levels, so one very strong or very
 * weak region can't carry it, and regions without data aren't counted as zero: they're listed instead.
 */
export function overallRank(regions: RegionRank[]): OverallRank {
  const assessed = regions.filter((r) => r.level != null);
  const notAssessed = regions.filter((r) => r.level == null).map((r) => ({ region: r.region, label: r.label, reason: r.notAssessed ?? "Not assessed." }));
  const total = regions.length;
  if (assessed.length < OVERALL_MIN_REGIONS) {
    return {
      level: null,
      rank: null,
      assessed: assessed.length,
      total,
      notAssessed,
      explanation: `An overall rank needs at least ${OVERALL_MIN_REGIONS} assessed regions; ${assessed.length} of ${total} are assessed so far.`,
    };
  }
  const levels = assessed.map((r) => r.level!).sort((a, b) => a - b);
  const level = levels[Math.floor((levels.length - 1) / 2)]!;
  return {
    level,
    rank: level > 0 ? STRENGTH_RANKS[level - 1]! : null,
    assessed: assessed.length,
    total,
    notAssessed,
    explanation: `The middle rank of your ${assessed.length} assessed regions (of ${total}). Regions that aren't assessed are left out, not counted as zero.`,
  };
}

export function rankAll(input: RankInput): { regions: RegionRank[]; overall: OverallRank } {
  const regions = BODY_REGIONS.map((r) => rankRegion(r, input));
  return { regions, overall: overallRank(regions) };
}

export function levelLabel(level: number | null): string {
  if (level == null) return "Not assessed";
  if (level === 0) return "Working toward Bronze";
  return STRENGTH_RANK_LABELS[STRENGTH_RANKS[level - 1]!];
}

/** The measure in words, for the "how it's scored" table. */
export function measureLabel(m: Measure): string {
  switch (m) {
    case "load_ratio":
      return "Estimated 1-rep max ÷ body weight";
    case "bodyweight_ratio":
      return "Estimated 1-rep max of body weight + added weight ÷ body weight";
    case "reps":
      return "Most reps in one set, body weight only";
    case "seconds":
      return "Longest hold in one set (seconds)";
  }
}

export function formatMeasure(m: Measure, v: number): string {
  if (m === "reps") return `${v} rep${v === 1 ? "" : "s"}`;
  if (m === "seconds") return `${v} s`;
  return `${v.toFixed(2)}× body weight`;
}
