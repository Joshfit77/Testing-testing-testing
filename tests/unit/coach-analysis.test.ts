import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { analyzeLiftProgress, type AnalysisSession, type CheckinInput, type LiftAnalysisInput, type SleepNightInput } from "@/lib/coach/lift-analysis";
import { summarizeRunning, type RunRecord } from "@/lib/coach/running-summary";
import { summarizeRecovery } from "@/lib/coach/recovery-summary";
import { toolActivityLabel, validateToolInput } from "@/lib/coach/tools";
import { executeCoachTool, type ToolContext } from "@/server/coach/tools";
import { athleteFixture, fakeSupabase } from "./fixtures/coach-fixtures";

const TODAY = "2026-11-13";
const ago = (d: number) => addDays(TODAY, -d);
const ids = (f: { id: string }[]) => f.map((x) => x.id);

/** One bench session: `sets` working sets of `kg` × `reps` at `rpe`. */
const bench = (daysAgo: number, kg: number, reps = 5, sets = 3, rpe: number | null = 8): AnalysisSession => ({
  date: ago(daysAgo),
  sets: Array.from({ length: sets }, () => ({ reps, weightKg: kg, rpe })),
});

const base = (sessions: AnalysisSession[], over: Partial<LiftAnalysisInput> = {}): LiftAnalysisInput => ({
  exercise: { slug: "bench-press", name: "Bench Press" },
  today: TODAY,
  weeks: 12,
  units: "metric",
  sessions,
  program: null,
  sleep: [],
  checkins: [],
  ...over,
});

/** ~10 weeks, twice a week: rising for 3 weeks, then stuck at 100 kg × 5 for 7 weeks. */
function plateauSessions(): AnalysisSession[] {
  const out: AnalysisSession[] = [];
  const climb = [90, 92.5, 95, 97.5, 100, 100];
  for (let i = 0; i < 20; i++) {
    const daysAgo = 70 - i * 3.5;
    out.push(bench(Math.round(daysAgo), climb[i] ?? 100, i < 6 ? 5 : 4 + (i % 2)));
  }
  return out;
}

describe("analyze_lift_progress", () => {
  it("finds a plateau with evidence and no progress claim", () => {
    const a = analyzeLiftProgress(base(plateauSessions()));
    expect(a.sessions_in_window).toBe(20);
    expect(ids(a.findings)).toContain("plateau");
    expect(ids(a.findings)).not.toContain("progressing");
    expect(ids(a.findings)).not.toContain("insufficient_data");
    const plateau = a.findings.find((f) => f.id === "plateau")!;
    // 100 × 5 (116.67 kg e1RM) was first hit in the 5th session; 15 sessions followed without beating it.
    expect(plateau.evidence).toMatch(/Best e1RM 116\.7 kg was set on \d{4}-\d\d-\d\d \(\d+ days ago\); 15 sessions since without beating it\./);
    expect(a.records.sessions_since_e1rm_pr).toBe(15);
    expect(a.records.best_e1rm).toBe(116.7);
    expect(a.e1rm!.change_4w_pct).toBeLessThanOrEqual(0);
    expect(a.frequency.sessions_per_week).toBeGreaterThanOrEqual(1.5);
    expect(a.weekly.length).toBeGreaterThanOrEqual(10);
    expect(a.weekly.every((w) => w.hard_sets >= 0)).toBe(true);
  });

  it("reports progress when e1RM keeps rising", () => {
    const sessions = Array.from({ length: 16 }, (_, i) => bench(75 - i * 5, 80 + i * 2.5));
    const a = analyzeLiftProgress(base(sessions));
    expect(ids(a.findings)).toContain("progressing");
    expect(ids(a.findings)).not.toContain("plateau");
    expect(a.records.sessions_since_e1rm_pr).toBe(0);
    expect(a.e1rm!.change_4w_pct).toBeGreaterThan(0);
    expect(a.e1rm!.window_change_pct).toBeGreaterThan(0);
    expect(a.findings.find((f) => f.id === "progressing")!.evidence).toBe("New best e1RM 137.1 kg on 2026-11-13, up from 134.2 kg.");
  });

  it("returns only insufficient_data on thin data, and asks for more sessions first", () => {
    const a = analyzeLiftProgress(base([bench(20, 100), bench(10, 100), bench(3, 100)]));
    expect(a.findings).toEqual([{ id: "insufficient_data", evidence: "3 sessions with Bench Press in the last 12 weeks; at least 4 are needed before judging a trend." }]);
    expect(a.e1rm).toBeNull();
    expect(a.rpe.same_load).toBeNull();
    expect(a.hard_sets_per_week.change_pct).toBeNull();
    expect(a.missing[0]).toBe("fewer than 4 Bench Press sessions in the last 12 weeks");
  });

  it("flags poor attendance against the active program", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => bench(54 - i * 7, 100 + i));
    const program = { name: "Upper Lower", daysPerWeek: 4, startedOn: ago(55), completedDates: sessions.map((s) => s.date) };
    const a = analyzeLiftProgress(base(sessions, { program }));
    expect(a.program_consistency).toMatchObject({ planned_sessions: 32, completed_sessions: 8, pct: 25 });
    expect(a.findings.find((f) => f.id === "inconsistent")!.evidence).toBe(`8 of 32 planned Upper Lower sessions since ${ago(55)} (25%).`);
    // The same attendance at 1 day a week is fine.
    const ok = analyzeLiftProgress(base(sessions, { program: { ...program, daysPerWeek: 1 } }));
    expect(ids(ok.findings)).not.toContain("inconsistent");
  });

  it("flags a volume drop, low frequency and gap weeks", () => {
    const prior = [50, 47, 43, 40, 36, 33, 29].map((d) => bench(d, 100, 5, 6));
    const recent = [20, 6].map((d) => bench(d, 100, 5, 3));
    const a = analyzeLiftProgress(base([...prior, ...recent], { weeks: 8 }));
    expect(a.hard_sets_per_week.prior_4_weeks_avg).toBe(10.5);
    expect(a.hard_sets_per_week.last_4_weeks_avg).toBe(1.5);
    expect(ids(a.findings)).toContain("volume_dropped");
    expect(a.findings.find((f) => f.id === "volume_dropped")!.evidence).toContain("10.5 in the 4 weeks before → 1.5 in the last 4 weeks (-85.7%)");
    expect(ids(a.findings)).toContain("gap_weeks");
    const sparse = analyzeLiftProgress(base([bench(80, 90), bench(60, 92.5), bench(40, 95), bench(20, 95), bench(5, 95)]));
    expect(ids(sparse.findings)).toContain("low_frequency");
    expect(sparse.frequency.sessions_per_week).toBe(0.4);
  });

  it("flags RPE rising at the same load and reps", () => {
    const sessions = [bench(50, 100, 5, 3, 7), bench(43, 100, 5, 3, 7.5), bench(36, 100, 5, 3, 7), bench(20, 100, 5, 3, 8.5), bench(13, 100, 5, 3, 9), bench(6, 100, 5, 3, 9)];
    const a = analyzeLiftProgress(base(sessions));
    expect(a.rpe.same_load).toMatchObject({ load: 100, reps: 5, prior_4_weeks_avg_rpe: 7.2, last_4_weeks_avg_rpe: 8.8, change: 1.7 });
    expect(a.findings.find((f) => f.id === "rpe_rising_at_same_load")!.evidence).toBe(
      "At 100 kg × 5: average RPE 7.2 (9 sets, 4 weeks before) → 8.8 (9 sets, last 4 weeks).",
    );
  });

  it("adds recovery context with counts, and short sleep only over 5+ nights", () => {
    const nights = (n: number, minutes: number): SleepNightInput[] => Array.from({ length: n }, (_, i) => ({ date: ago(i + 1), asleepMinutes: minutes, recorded: i % 2 === 0, estimated: i === 0 }));
    const checkins: CheckinInput[] = [
      { date: ago(2), readiness: 50, energy: 3, soreness: 3, stress: 3, sleepQuality: 2 },
      { date: ago(9), readiness: 70, energy: 4, soreness: 2, stress: 2, sleepQuality: 4 },
    ];
    const a = analyzeLiftProgress(base(plateauSessions(), { sleep: nights(6, 360), checkins }));
    expect(a.recovery.sleep).toEqual({ nights: 6, avg_asleep_hours: 6, recorded_nights: 3, self_reported_nights: 3, in_bed_only_nights: 1 });
    expect(a.recovery.checkins).toMatchObject({ count: 2, readiness_avg: 60, energy_avg: 3.5 });
    expect(a.findings.find((f) => f.id === "short_sleep")!.evidence).toBe("Average 6 h asleep over 6 logged nights in this window (1 are time in bed only).");
    expect(ids(analyzeLiftProgress(base(plateauSessions(), { sleep: nights(4, 300) })).findings)).not.toContain("short_sleep");
  });

  it("lists the most useful missing data", () => {
    const noRpe = Array.from({ length: 6 }, (_, i) => bench(40 - i * 6, 100, 5, 3, null));
    const a = analyzeLiftProgress(base(noRpe, { sleep: null }));
    expect(a.missing).toEqual([
      "no RPE logged for Bench Press",
      "no sleep data (sleep logging isn't switched on)",
      "no recovery check-ins in this window",
      "no active program, so attendance against a plan can't be checked",
    ]);
    expect(a.recovery.sleep).toBeNull();
  });

  it("reports loads in the athlete's unit", () => {
    const a = analyzeLiftProgress(base(plateauSessions(), { units: "imperial" }));
    expect(a.unit).toBe("lb");
    expect(a.records.best_e1rm).toBe(257.2);
    expect(a.records.heaviest_set).toBe(220.5);
    expect(a.findings.find((f) => f.id === "plateau")!.evidence).toContain("257.2 lb");
  });

  it("ignores sessions dated after today and never extrapolates", () => {
    const a = analyzeLiftProgress(base([...plateauSessions(), bench(-3, 150)]));
    expect(a.records.best_e1rm).toBe(116.7);
    expect(JSON.stringify(a)).not.toMatch(/predict|projected|forecast/i);
  });
});

const run = (daysAgo: number, km: number | null, minutesPerKm = 6, source: RunRecord["source"] = "gps", extra: Partial<RunRecord> = {}): RunRecord => ({
  date: ago(daysAgo),
  source,
  imported: false,
  distanceM: km == null ? null : km * 1000,
  movingS: Math.round((km ?? 5) * minutesPerKm * 60),
  perceivedEffort: null,
  ...extra,
});

describe("get_running_summary", () => {
  it("flags a weekly distance rise above 10% with the numbers", () => {
    const runs = [run(25, 5), run(22, 5), run(18, 5), run(15, 5), run(11, 5), run(9, 5), run(5, 8), run(3, 8), run(1, 8)];
    const s = summarizeRunning({ today: TODAY, weeks: 8, units: "metric", runs, lastRunDate: ago(1) });
    expect(s.weekly_distance_change).toMatchObject({ last_7_days: 24, previous_7_days: 10, week_over_week_pct: 140 });
    expect(s.flags).toEqual([{ id: "distance_ramp", evidence: "Last 7 days 24 km vs 10 km the week before (+140%, above the 10% guideline)." }]);
    expect(s.days_since_last_run).toBe(1);
    expect(s.longest_run).toEqual({ date: ago(1), distance: 8, source: "gps" });
  });

  it("does not flag a steady week", () => {
    const runs = [run(13, 10), run(9, 10), run(6, 10.5), run(2, 10.5)];
    const s = summarizeRunning({ today: TODAY, weeks: 4, units: "metric", runs, lastRunDate: ago(2) });
    expect(s.flags).toEqual([]);
    expect(s.weekly_distance_change.week_over_week_pct).toBe(5);
  });

  it("labels each run's source, takes pace only from runs with distance and time, and reports the pace trend", () => {
    const runs = [
      run(50, 5, 6.5),
      run(45, 5, 6.4, "treadmill"),
      run(40, 5.2, 6.3),
      run(20, 5, 6),
      run(12, 5.1, 5.9, "gps", { imported: true }),
      run(6, 4.9, 5.8),
      run(3, null, 0, "manual", { movingS: 1800, perceivedEffort: 4 }),
    ];
    const s = summarizeRunning({ today: TODAY, weeks: 8, units: "metric", runs, lastRunDate: ago(3) });
    expect(s.sources).toEqual({ gps: 5, treadmill: 1, manual: 1, imported: 1 });
    expect(s.average_pace!.from_runs).toBe(6);
    expect(s.recent_runs[0]).toEqual({ date: ago(3), source: "manual", distance: null, moving_minutes: 30, pace: null });
    expect(s.recent_runs.find((r) => r.date === ago(12))).toMatchObject({ source: "gps", imported: true });
    expect(s.pace_trend).toMatchObject({ direction: "faster", older_half: { runs: 3 }, newer_half: { runs: 3 } });
    expect(s.missing).toContain("1 run has no distance, so no pace");
    expect(s.perceived_effort).toEqual({ avg: 4, runs: 1, scale: "1–10" });
    // Heart rate is never stored for runs, so no heart-rate field is ever returned.
    expect(Object.keys(s).some((k) => /heart|bpm|hr/i.test(k))).toBe(false);
  });

  it("returns insufficient data and no trend for thin data, in miles for imperial", () => {
    const s = summarizeRunning({ today: TODAY, weeks: 4, units: "imperial", runs: [run(5, 8.04672)], lastRunDate: ago(5) });
    expect(s.unit).toBe("mi");
    expect(s.longest_run!.distance).toBe(5);
    expect(s.pace_trend).toBeNull();
    expect(ids(s.flags)).toEqual(["insufficient_data"]);
    expect(s.missing[0]).toBe("fewer than 3 runs in the window");
    const none = summarizeRunning({ today: TODAY, weeks: 4, units: "metric", runs: [], lastRunDate: ago(90) });
    expect(none.days_since_last_run).toBe(90);
    expect(none.average_pace).toBeNull();
    expect(none.missing[0]).toBe("no runs recorded in the last 4 weeks");
  });
});

describe("get_recovery_summary", () => {
  const session = (daysAgo: number, sets = 12, rpe: number | null = 8) => ({ date: ago(daysAgo), sets: Array.from({ length: sets }, () => ({ reps: 5, weightKg: 100, rpe })) });
  const checkin = (daysAgo: number, readiness: number): CheckinInput => ({ date: ago(daysAgo), readiness, energy: 3, soreness: 3, stress: 2, sleepQuality: 3 });

  it("summarizes check-ins, labelled sleep and load, and is never a diagnosis", () => {
    const s = summarizeRecovery({
      today: TODAY,
      days: 14,
      checkins: [checkin(13, 80), checkin(11, 78), checkin(4, 55), checkin(1, 50)],
      sleep: Array.from({ length: 7 }, (_, i) => ({ date: ago(i), asleepMinutes: 390, recorded: i < 3, estimated: i === 6 })),
      sleepGoalMinutes: 480,
      sessions: [26, 23, 19, 16, 12, 9, 5, 2].map((d) => session(d)),
    });
    expect(s.not_a_diagnosis).toBe(true);
    expect(s.checkins).toMatchObject({ count: 4, readiness_avg: 65.8, readiness_trend: { older_half_avg: 79, newer_half_avg: 52.5, direction: "lower" }, latest: { date: ago(1), readiness: 50 } });
    expect(s.sleep).toMatchObject({ available: true, nights: 7, avg_asleep_hours: 6.5, recorded_nights: 3, self_reported_nights: 4, in_bed_only_nights: 1, nights_at_goal: 0 });
    expect(s.training_load).toMatchObject({ sessions: 4, sessions_per_week: 2, hard_sets_per_week: 24 });
    expect(s.training_load.acute_chronic).toMatchObject({ sessions: { last_7_days: 2, weekly_avg_28_days: 2, ratio: 1 }, weeks_with_sessions: 4 });
    expect(ids(s.observations)).toEqual(["readiness_lower", "short_sleep"]);
    expect(s.missing).toEqual([]);
  });

  it("works without sleep data and skips acute vs chronic with under 3 weeks of data", () => {
    const s = summarizeRecovery({ today: TODAY, days: 14, checkins: [], sleep: null, sleepGoalMinutes: 480, sessions: [session(10, 10, null), session(3, 10, null)] });
    expect(s.sleep).toEqual({ available: false, note: "Sleep logging isn't switched on (optional wellness data)." });
    expect(s.checkins).toBeNull();
    expect(s.training_load.acute_chronic).toBeNull();
    expect(s.missing).toEqual([
      "no recovery check-ins in the last 14 days",
      "no sleep data (sleep logging isn't switched on)",
      "fewer than 3 of the last 4 weeks have workouts, so no acute vs chronic load",
      "no RPE logged, so every working set counts as hard",
    ]);
  });

  it("notes load well above the usual week", () => {
    const s = summarizeRecovery({ today: TODAY, days: 7, checkins: [], sleep: [], sleepGoalMinutes: 480, sessions: [session(24, 8), session(17, 8), session(10, 8), session(5, 16), session(2, 16)] });
    expect(s.training_load.acute_chronic).toMatchObject({ hard_sets: { last_7_days: 32, weekly_avg_28_days: 14, ratio: 2.29 } });
    expect(ids(s.observations)).toContain("load_above_usual");
    expect(s.missing).toContain("no sleep logged in the last 7 days");
  });
});

describe("analysis tool wiring", () => {
  it("validates windows (null = default) and labels activity", () => {
    expect(validateToolInput("analyze_lift_progress", { exercise: "bench-press", weeks: null }).ok).toBe(true);
    expect(validateToolInput("analyze_lift_progress", { exercise: "bench-press", weeks: 3 }).ok).toBe(false);
    expect(validateToolInput("get_running_summary", { weeks: 27 }).ok).toBe(false);
    expect(validateToolInput("get_recovery_summary", { days: 14, user_id: "x" }).ok).toBe(false);
    expect(toolActivityLabel("analyze_lift_progress", { exercise: "bench-press", weeks: null })).toBe("Analyzing your bench press over the last 12 weeks…");
    expect(toolActivityLabel("get_running_summary", { weeks: 6 })).toBe("Checking your runs from the last 6 weeks…");
    expect(toolActivityLabel("get_recovery_summary", { days: null })).toBe("Checking your recovery over the last 14 days…");
  });

  it("reads runs only for the signed-in user, never walks or deleted runs", async () => {
    const USER = "11111111-1111-1111-1111-111111111111";
    const { client, log } = fakeSupabase({ activities: { data: [{ started_at: `${ago(2)}T07:00:00Z`, source: "gps", distance_m: 5000, moving_s: 1500, perceived_effort: null, external_id: null }], error: null } });
    const ctx: ToolContext = { supabase: client, userId: USER, timeZone: "UTC", snapshot: athleteFixture({ today: TODAY }), proposal: null };
    const out = await executeCoachTool(ctx, "get_running_summary", { weeks: null });
    expect(out.isError).toBe(false);
    expect(JSON.parse(out.content)).toMatchObject({ unit: "km", runs_in_window: 1, window: { weeks: 8 } });
    const calls = log.filter((l) => l.table === "activities");
    expect(calls.length).toBe(2);
    for (const c of calls) {
      expect(c.calls).toContainEqual(["eq", ["user_id", USER]]);
      expect(c.calls).toContainEqual(["eq", ["kind", "run"]]);
      expect(c.calls).toContainEqual(["is", ["deleted_at", null]]);
    }
  });
});
