import { describe, expect, it } from "vitest";
import { badgesUnlockedBySession, computeAchievements, emptyStats, localHour, prMoments, withoutSession, type AchievementStats, type PrEvent, type WorkoutEvent } from "@/lib/domain/achievements";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { categoryProgress } from "@/lib/domain/ranks";
import { dailyStreak, streakNeedsOlderHistory, weeklyStreak } from "@/lib/domain/streak";
import { strengthTrend } from "@/lib/domain/strength";
import { levelLabel, overallRank, rankRegion, scoreBenchmark, REGION_BENCHMARKS, type RankSession } from "@/lib/domain/strength-ranks";

/**
 * Progress and gamification audit, 2026-11-14 (docs/audit-2026-11-14/workouts-programs-progress.md). Every expected
 * value here was worked out by hand from the rule stated beside it.
 */

describe("strength trend: one session is not a trend (audit P-1)", () => {
  it("has no change to report from a single session in the range", () => {
    // The overview used to print "0 lb over 30 days" here, which reads as "no progress" after one workout.
    expect(strengthTrend([225])).toEqual({ latest: 225, change: null, sessions: 1 });
  });

  it("reports first-to-last change once there are two or more sessions, to one decimal", () => {
    expect(strengthTrend([225, 230, 232.5])).toEqual({ latest: 232.5, change: 7.5, sessions: 3 });
    expect(strengthTrend([100.1, 100.4])).toEqual({ latest: 100.4, change: 0.3, sessions: 2 });
    // A real zero (same estimate twice) is a value, not "no data".
    expect(strengthTrend([200, 200])).toEqual({ latest: 200, change: 0, sessions: 2 });
    expect(strengthTrend([200, 190])!.change).toBe(-10);
  });

  it("is null with no sessions, and ignores values that aren't numbers", () => {
    expect(strengthTrend([])).toBeNull();
    expect(strengthTrend([Number.NaN, 150])).toEqual({ latest: 150, change: null, sessions: 1 });
  });
});

describe("the calendar day a workout belongs to (time zones, midnight)", () => {
  it("is the member's local day, not the UTC day", () => {
    // 11:30 pm on Oct 31 in Los Angeles is already Nov 1 in UTC.
    expect(isoDateInTz(new Date("2026-11-01T06:30:00Z"), "America/Los_Angeles")).toBe("2026-10-31");
    expect(isoDateInTz(new Date("2026-11-01T06:30:00Z"), "UTC")).toBe("2026-11-01");
    // 00:30 am on Nov 2 in Auckland is still Nov 1 in UTC.
    expect(isoDateInTz(new Date("2026-11-01T11:30:00Z"), "Pacific/Auckland")).toBe("2026-11-02");
    // An unknown zone falls back to the UTC day rather than throwing.
    expect(isoDateInTz(new Date("2026-11-01T06:30:00Z"), "Not/AZone")).toBe("2026-11-01");
  });

  it("stays on the right day across the autumn clock change (a 25-hour day)", () => {
    // US clocks go back at 2 am on Sunday 2026-11-01: 08:30 UTC is 00:30 PST the same Sunday.
    expect(isoDateInTz(new Date("2026-11-01T07:59:00Z"), "America/Los_Angeles")).toBe("2026-11-01"); // 00:59 PDT
    expect(isoDateInTz(new Date("2026-11-02T07:59:00Z"), "America/Los_Angeles")).toBe("2026-11-01"); // 23:59 PST
    expect(isoDateInTz(new Date("2026-11-02T08:00:00Z"), "America/Los_Angeles")).toBe("2026-11-02"); // 00:00 PST
    expect(localHour("2026-11-01T12:30:00Z", "America/Los_Angeles")).toBe(4); // 04:30 PST: an early-bird hour
  });

  it("two workouts either side of local midnight are two days of streak; the same pair in UTC are one", () => {
    const late = new Date("2026-11-11T07:30:00Z"); // 11:30 pm Tue Nov 10 in Los Angeles
    const early = new Date("2026-11-11T08:30:00Z"); // 00:30 am Wed Nov 11 in Los Angeles
    const la = [late, early].map((d) => isoDateInTz(d, "America/Los_Angeles"));
    expect(la).toEqual(["2026-11-10", "2026-11-11"]);
    expect(dailyStreak(la, "2026-11-11")).toBe(2);
    const utc = [late, early].map((d) => isoDateInTz(d, "UTC"));
    expect(dailyStreak(utc, "2026-11-11")).toBe(1);
  });
});

describe("streaks (checked by hand)", () => {
  // 2026-11-14 is a Saturday; its week starts Monday 2026-11-09.
  const today = "2026-11-14";

  it("a day streak survives until a whole day passes without training", () => {
    expect(startOfWeek(today)).toBe("2026-11-09");
    expect(dailyStreak(["2026-11-12", "2026-11-13"], today)).toBe(2); // nothing yet today: still alive
    expect(dailyStreak(["2026-11-12", "2026-11-13", "2026-11-14"], today)).toBe(3);
    expect(dailyStreak(["2026-11-11", "2026-11-12"], today)).toBe(0); // missed all of the 13th
    expect(dailyStreak(["2026-11-13", "2026-11-13", "2026-11-13"], today)).toBe(1); // three sessions, one day
  });

  it("a week streak counts Monday-to-Sunday weeks and isn't broken by a week still in progress", () => {
    const dates = ["2026-10-26", "2026-11-08"]; // Mon of week Oct 26, Sun of week Nov 2
    expect(weeklyStreak(dates, today)).toBe(2); // this week (Nov 9) has nothing yet
    expect(weeklyStreak([...dates, "2026-11-09"], today)).toBe(3);
    expect(weeklyStreak(["2026-10-26", "2026-11-09"], today)).toBe(1); // the week of Nov 2 was missed
    expect(weeklyStreak([], today)).toBe(0);
  });

  it("asks for older history only while the run of trained weeks reaches the oldest loaded week", () => {
    expect(streakNeedsOlderHistory(["2026-11-02", "2026-11-09"], today, "2026-11-02")).toBe(true);
    expect(streakNeedsOlderHistory(["2026-11-09"], today, "2026-10-01")).toBe(false);
    expect(streakNeedsOlderHistory([], today, "2026-10-01")).toBe(false);
  });
});

describe("badges and ranks come only from data that still exists", () => {
  const w = (i: number, date: string, volumeKg = 1000): WorkoutEvent => ({ sessionId: `s${i}`, date, startHour: 18, volumeKg, startedAt: `${date}T18:00:00Z` });
  const pr = (sessionId: string, date: string, recordType = "max_weight"): PrEvent => ({ sessionId, exerciseId: "bench", recordType, achievedAt: `${date}T19:00:00Z`, date });
  const stats = (over: Partial<AchievementStats>): AchievementStats => ({ ...emptyStats(), ...over });
  const earned = (s: AchievementStats) => computeAchievements(s, "2026-11-14").filter((b) => b.earned).map((b) => b.id);

  it("deleting the 10th workout takes the 10-workout badge back", () => {
    const ten = Array.from({ length: 10 }, (_, i) => w(i, addDays("2026-11-01", i)));
    expect(earned(stats({ workouts: ten }))).toContain("workouts-10");
    expect(earned(stats({ workouts: ten.slice(0, 9) }))).not.toContain("workouts-10");
    expect(categoryProgress("fitness", { workoutDates: ten.map((x) => x.date), foodDays: [], faithDays: [] }).current?.name).toBe("Faithful");
    expect(categoryProgress("fitness", { workoutDates: ten.slice(0, 9).map((x) => x.date), foodDays: [], faithDays: [] }).current?.name).toBe("Foundation");
  });

  it("a first-ever record is a baseline: one workout can never earn the PR badge", () => {
    const s = stats({ workouts: [w(1, "2026-11-01")], prs: [pr("s1", "2026-11-01"), pr("s1", "2026-11-01", "estimated_1rm"), pr("s1", "2026-11-01", "max_set_volume")] });
    expect(prMoments(s.prs)).toEqual([]);
    expect(earned(s)).not.toContain("first-pr");
  });

  it("the PR badge follows the record: remove the session that set it and the badge is gone", () => {
    const s = stats({ workouts: [w(1, "2026-11-01"), w(2, "2026-11-03")], prs: [pr("s1", "2026-11-01"), pr("s2", "2026-11-03")] });
    expect(earned(s)).toContain("first-pr");
    expect(badgesUnlockedBySession(s, "s2", "2026-11-14").map((b) => b.id)).toEqual(["first-pr"]);
    expect(earned(withoutSession(s, "s2"))).not.toContain("first-pr");
  });

  it("volume badges add up stored session volumes; an edited-down session lowers the total", () => {
    const heavy = stats({ workouts: [w(1, "2026-11-01", 30_000), w(2, "2026-11-02", 15_360)] }); // 45,360 kg ≥ 45,359.24 kg (100,000 lb)
    expect(earned(heavy)).toContain("volume-100k-lb");
    const edited = stats({ workouts: [w(1, "2026-11-01", 30_000), w(2, "2026-11-02", 15_000)] });
    expect(earned(edited)).not.toContain("volume-100k-lb");
  });

  it("nothing at all is earned, and no rank is held, with no data", () => {
    expect(earned(emptyStats())).toEqual([]);
    const p = categoryProgress("fitness", { workoutDates: [], foodDays: [], faithDays: [] });
    expect(p).toMatchObject({ count: 0, current: null, percentToNext: 0 });
    expect(p.next?.name).toBe("Foundation");
  });
});

describe("strength ranks tell 'no data', 'can't be scored' and a real value apart", () => {
  const session = (id: string, date: string, slug: string, sets: { reps: number | null; weightKg: number | null }[]): RankSession => ({
    id,
    date,
    exercises: [{ slug, sets: sets.map((s) => ({ ...s, durationSeconds: null, completed: true, isWarmup: false })) }],
  });
  const bench = REGION_BENCHMARKS.chest.find((b) => b.slug === "bench-press")!;
  const today = "2026-11-14";

  it("no sets logged: not assessed, with that reason (never a zero)", () => {
    const r = scoreBenchmark(bench, { sessions: [], bodyweightKg: 80, table: "men", today });
    expect(r.level).toBeNull();
    expect(r.value).toBeNull();
    expect(r.notAssessed).toMatch(/No completed working sets/);
    expect(levelLabel(r.level)).toBe("Not assessed");
  });

  it("sets logged but no body weight: asks for the body weight instead of ignoring the workout silently", () => {
    const r = scoreBenchmark(bench, { sessions: [session("a", "2026-11-10", "bench-press", [{ reps: 5, weightKg: 80 }])], bodyweightKg: null, table: "men", today });
    expect(r.level).toBeNull();
    expect(r.notAssessed).toMatch(/Log your body weight/);
  });

  it("a real but low value is level 0 'Working toward Bronze', which is not 'Not assessed'", () => {
    // 30 kg × 5 → e1RM 35 kg; ÷ 80 kg = 0.44, under the men's Bronze line of 0.5.
    const r = scoreBenchmark(bench, { sessions: [session("a", "2026-11-10", "bench-press", [{ reps: 5, weightKg: 30 }])], bodyweightKg: 80, table: "men", today });
    expect(r.level).toBe(0);
    expect(r.value).toBe(0.44);
    expect(levelLabel(r.level)).toBe("Working toward Bronze");
  });

  it("hand-computed rank: 100 kg × 5 at 80 kg body weight is 1.46× → Platinum on the men's table", () => {
    // e1RM = 100 × (1 + 5/30) = 116.67; 116.67 ÷ 80 = 1.458. The men's bench lines are 0.5, 0.75, 1.0, 1.25, 1.5 and
    // 1.75 (Bronze … Disciple): 1.458 is past Platinum (1.25) and short of Diamond (1.5) → level 4.
    const r = scoreBenchmark(bench, { sessions: [session("a", "2026-11-10", "bench-press", [{ reps: 5, weightKg: 100 }])], bodyweightKg: 80, table: "men", today });
    expect(r.value).toBe(1.46);
    expect(r.level).toBe(4);
    expect(levelLabel(r.level)).toBe("Platinum");
  });

  it("a set older than 12 months no longer counts, and says so as 'no sets in the last 12 months'", () => {
    const r = scoreBenchmark(bench, { sessions: [session("old", "2025-11-13", "bench-press", [{ reps: 5, weightKg: 100 }])], bodyweightKg: 80, table: "men", today });
    expect(r.level).toBeNull();
    expect(r.notAssessed).toMatch(/last 12 months/);
  });

  it("the overall rank needs four assessed regions and never counts a missing region as zero", () => {
    const input = { sessions: [session("a", "2026-11-10", "bench-press", [{ reps: 5, weightKg: 100 }])], bodyweightKg: 80, table: "men" as const, today };
    const chest = rankRegion("chest", input);
    expect(chest.level).toBe(4);
    const calves = rankRegion("calves", input);
    expect(calves.level).toBeNull();
    const overall = overallRank([chest, calves]);
    expect(overall.level).toBeNull();
    expect(overall.assessed).toBe(1);
    expect(overall.explanation).toMatch(/at least 4 assessed regions/);
  });
});
