import { BODY_REGIONS, WEEKLY_SET_RANGES, regionShares, type BodyRegion } from "./body-regions";
import { addDays, startOfWeek } from "./dates";
import { estimateOneRepMax } from "./strength";
import type { RankSession, RankSet } from "./strength-ranks";

/**
 * What the muscle map shows for each region, computed from the member's own completed workouts. Each logged set is
 * counted once (sessions are de-duplicated by id). A set counts 1 toward a region the exercise trains as a primary
 * muscle and 0.5 toward a secondary one, the usual convention for weekly volume. Load volume (kg × reps) is counted
 * only for primary muscles, and only for sets with a logged load.
 */

export interface MapExercise {
  slug: string;
  name: string;
  primary: string[];
  secondary: string[];
  sets: RankSet[];
}

export interface MapSession extends Omit<RankSession, "exercises"> {
  exercises: MapExercise[];
}

export interface MapRecord {
  slug: string;
  name: string;
  recordType: "estimated_1rm" | "max_weight" | "max_reps" | "max_set_volume" | "max_duration";
  value: number;
  weightKg: number | null;
  reps: number | null;
  date: string;
  primary: string[];
}

export interface RegionStats {
  region: BodyRegion;
  exercises: { slug: string; name: string; role: "primary" | "secondary"; sets: number; lastDate: string }[];
  /** Weighted sets in the last 7 days, used to colour the "weekly sets" view. */
  setsThisWeek: number;
  setRange: [number, number] | null;
  last28: PeriodStats;
  previous28: PeriodStats;
  year: PeriodStats;
  /** Weighted sets per week for the last 12 weeks (Monday starts), oldest first. */
  weekly: { weekStart: string; sets: number }[];
  /** Best estimated 1RM per month (kg) of the region's most-logged loaded primary lift, last 12 months. */
  strength: { slug: string; name: string; points: { month: string; e1rmKg: number }[] } | null;
  records: MapRecord[];
}

export interface PeriodStats {
  workouts: number;
  sets: number;
  volumeKg: number;
  /** Workouts per week over the period. */
  perWeek: number;
  /** Best estimated 1RM of the strength lift in the period (kg), when there is one. */
  bestE1rmKg: number | null;
}

function working(s: RankSet): boolean {
  return s.completed && !s.isWarmup;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function uniqueSessions(sessions: MapSession[]): MapSession[] {
  const seen = new Set<string>();
  return sessions.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

function period(sessions: MapSession[], region: BodyRegion, from: string, to: string, days: number, strengthSlug: string | null): PeriodStats {
  let workouts = 0;
  let sets = 0;
  let volume = 0;
  let best: number | null = null;
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    let touched = false;
    for (const e of s.exercises) {
      const share = regionShares(e.primary, e.secondary).get(region);
      if (!share) continue;
      const done = e.sets.filter(working);
      if (!done.length) continue;
      touched = true;
      sets += share * done.length;
      if (share === 1) for (const x of done) volume += (x.weightKg ?? 0) * (x.reps ?? 0);
      if (e.slug === strengthSlug) {
        for (const x of done) {
          const e1 = x.weightKg && x.reps ? estimateOneRepMax(x.weightKg, x.reps) : null;
          if (e1 != null && (best == null || e1 > best)) best = e1;
        }
      }
    }
    if (touched) workouts++;
  }
  return { workouts, sets: round1(sets), volumeKg: Math.round(volume), perWeek: round1(workouts / (days / 7)), bestE1rmKg: best == null ? null : round1(best) };
}

/** The region's most-logged loaded primary lift in the last 12 months: the one whose strength trend is shown. */
function strengthLift(sessions: MapSession[], region: BodyRegion, from: string): { slug: string; name: string } | null {
  const counts = new Map<string, { name: string; n: number }>();
  for (const s of sessions) {
    if (s.date < from) continue;
    for (const e of s.exercises) {
      if (regionShares(e.primary, e.secondary).get(region) !== 1) continue;
      const loaded = e.sets.filter((x) => working(x) && (x.weightKg ?? 0) > 0 && (x.reps ?? 0) > 0 && (x.reps ?? 0) <= 12).length;
      if (!loaded) continue;
      const c = counts.get(e.slug) ?? { name: e.name, n: 0 };
      c.n += loaded;
      counts.set(e.slug, c);
    }
  }
  let top: { slug: string; name: string; n: number } | null = null;
  for (const [slug, c] of counts) if (!top || c.n > top.n || (c.n === top.n && slug < top.slug)) top = { slug, ...c };
  return top ? { slug: top.slug, name: top.name } : null;
}

export function regionStats(region: BodyRegion, input: { sessions: MapSession[]; records: MapRecord[]; today: string }): RegionStats {
  const sessions = uniqueSessions(input.sessions);
  const { today } = input;
  const yearFrom = addDays(today, -364);
  const lift = strengthLift(sessions, region, yearFrom);
  const slug = lift?.slug ?? null;

  const exercises = new Map<string, { slug: string; name: string; role: "primary" | "secondary"; sets: number; lastDate: string }>();
  for (const s of sessions) {
    if (s.date < yearFrom || s.date > today) continue;
    for (const e of s.exercises) {
      const share = regionShares(e.primary, e.secondary).get(region);
      if (!share) continue;
      const n = e.sets.filter(working).length;
      if (!n) continue;
      const cur = exercises.get(e.slug) ?? { slug: e.slug, name: e.name, role: share === 1 ? ("primary" as const) : ("secondary" as const), sets: 0, lastDate: s.date };
      cur.sets += n;
      if (s.date > cur.lastDate) cur.lastDate = s.date;
      exercises.set(e.slug, cur);
    }
  }

  const thisWeekStart = startOfWeek(today);
  const weekly: { weekStart: string; sets: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(thisWeekStart, -7 * i);
    weekly.push({ weekStart: ws, sets: period(sessions, region, ws, addDays(ws, 6), 7, null).sets });
  }

  let strength: RegionStats["strength"] = null;
  if (lift) {
    const byMonth = new Map<string, number>();
    for (const s of sessions) {
      if (s.date < yearFrom || s.date > today) continue;
      for (const e of s.exercises) {
        if (e.slug !== lift.slug) continue;
        for (const x of e.sets) {
          if (!working(x) || !x.weightKg || !x.reps) continue;
          const e1 = estimateOneRepMax(x.weightKg, x.reps);
          if (e1 == null) continue;
          const m = s.date.slice(0, 7);
          byMonth.set(m, Math.max(byMonth.get(m) ?? 0, e1));
        }
      }
    }
    strength = { ...lift, points: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, e1rmKg: round1(v) })) };
  }

  // Best record of each type per exercise (the table keeps a history of records).
  const bestRecords = new Map<string, MapRecord>();
  for (const r of input.records) {
    if (regionShares(r.primary, []).get(region) !== 1) continue;
    const k = `${r.slug}:${r.recordType}`;
    const cur = bestRecords.get(k);
    if (!cur || r.value > cur.value) bestRecords.set(k, r);
  }

  return {
    region,
    exercises: [...exercises.values()].sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name)),
    setsThisWeek: period(sessions, region, addDays(today, -6), today, 7, null).sets,
    setRange: WEEKLY_SET_RANGES[region] ?? null,
    last28: period(sessions, region, addDays(today, -27), today, 28, slug),
    previous28: period(sessions, region, addDays(today, -55), addDays(today, -28), 28, slug),
    year: period(sessions, region, yearFrom, today, 364, slug),
    weekly,
    strength,
    records: [...bestRecords.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  };
}

export function allRegionStats(input: { sessions: MapSession[]; records: MapRecord[]; today: string }): RegionStats[] {
  return BODY_REGIONS.map((r) => regionStats(r, input));
}

/** How this week's sets compare with the usual range, for the "weekly sets" colouring. */
export type VolumeBand = "none" | "low" | "in_range" | "high" | "no_range";
export function volumeBand(stats: Pick<RegionStats, "setsThisWeek" | "setRange">): VolumeBand {
  if (stats.setsThisWeek <= 0) return "none";
  if (!stats.setRange) return "no_range";
  const [lo, hi] = stats.setRange;
  return stats.setsThisWeek < lo ? "low" : stats.setsThisWeek > hi ? "high" : "in_range";
}
