import {
  BADGE_CATALOG,
  badgePercent,
  badgesUnlockedBySession,
  computeAchievements,
  dailyStreakEarnedAt,
  emptyStats,
  HUNDRED_K_LB_KG,
  localHour,
  MILLION_LB_KG,
  prMoments,
  volumeProgress,
  weeklyStreakEarnedAt,
  type AchievementStats,
  type BadgeState,
  type PrEvent,
  type WorkoutEvent,
} from "@/lib/domain/achievements";
import { addDays } from "@/lib/domain/dates";
import { displayWeight, kgToLb } from "@/lib/domain/units";

const TODAY = "2026-10-16";

function workout(i: number, date: string, opts: Partial<WorkoutEvent> = {}): WorkoutEvent {
  return { sessionId: `s${i}`, date, startHour: 18, volumeKg: 1000, startedAt: `${date}T18:00:00Z`, ...opts };
}

/** n workouts on consecutive days ending the day before `end`. */
function workouts(n: number, end = TODAY, opts: Partial<WorkoutEvent> = {}): WorkoutEvent[] {
  return Array.from({ length: n }, (_, i) => workout(i, addDays(end, -(n - i)), opts));
}

function badge(list: BadgeState[], id: string): BadgeState {
  const b = list.find((x) => x.id === id);
  if (!b) throw new Error(`no badge ${id}`);
  return b;
}

const stats = (over: Partial<AchievementStats>): AchievementStats => ({ ...emptyStats(), ...over });

describe("badge catalog", () => {
  it("has ~20 unique, well-formed badges across all categories", () => {
    expect(BADGE_CATALOG.length).toBeGreaterThanOrEqual(20);
    expect(new Set(BADGE_CATALOG.map((b) => b.id)).size).toBe(BADGE_CATALOG.length);
    expect(new Set(BADGE_CATALOG.map((b) => b.category))).toEqual(new Set(["training", "strength", "consistency", "nutrition", "faith", "milestones"]));
    for (const b of BADGE_CATALOG) {
      expect(b.target, b.id).toBeGreaterThan(0);
      expect(["bronze", "silver", "gold"]).toContain(b.tier);
    }
  });

  it("nothing is earned with no data", () => {
    const all = computeAchievements(emptyStats(), TODAY);
    expect(all.every((b) => !b.earned && b.earnedAt === null && b.current === 0)).toBe(true);
  });
});

describe("workout count badges", () => {
  it("earns at exactly the threshold with the date it was crossed", () => {
    const ws = workouts(10);
    const res = computeAchievements(stats({ workouts: ws }), TODAY);
    expect(badge(res, "first-workout")).toMatchObject({ earned: true, earnedAt: ws[0]!.date, current: 1 });
    expect(badge(res, "workouts-10")).toMatchObject({ earned: true, earnedAt: ws[9]!.date, current: 10 });
    expect(badge(res, "workouts-25")).toMatchObject({ earned: false, earnedAt: null, current: 10, target: 25 });
    expect(badgePercent(badge(res, "workouts-25"))).toBe(40);
  });

  it("is one short of the threshold → locked", () => {
    const res = computeAchievements(stats({ workouts: workouts(9) }), TODAY);
    expect(badge(res, "workouts-10").earned).toBe(false);
    expect(badge(res, "workouts-10").current).toBe(9);
  });

  it("orders by start time regardless of input order", () => {
    const ws = workouts(10).reverse();
    const res = computeAchievements(stats({ workouts: ws }), TODAY);
    expect(badge(res, "first-workout").earnedAt).toBe(addDays(TODAY, -10));
    expect(badge(res, "workouts-10").earnedAt).toBe(addDays(TODAY, -1));
  });
});

describe("early bird", () => {
  it("counts only sessions started from 4am to before 7am local", () => {
    const late = computeAchievements(stats({ workouts: [workout(1, "2026-10-01", { startHour: 7 }), workout(2, "2026-10-02", { startHour: 2 })] }), TODAY);
    expect(badge(late, "early-bird").earned).toBe(false);
    const early = computeAchievements(stats({ workouts: [workout(1, "2026-10-01", { startHour: 9 }), workout(2, "2026-10-03", { startHour: 6 })] }), TODAY);
    expect(badge(early, "early-bird")).toMatchObject({ earned: true, earnedAt: "2026-10-03" });
  });

  it("derives local hours across time zones", () => {
    expect(localHour("2026-10-16T11:30:00Z", "America/Chicago")).toBe(6);
    expect(localHour("2026-10-16T11:30:00Z", "UTC")).toBe(11);
    expect(localHour("2026-10-16T23:30:00Z", "Asia/Tokyo")).toBe(8);
    expect(localHour("2026-10-16T05:00:00Z", "Not/AZone")).toBe(5);
  });
});

describe("personal records", () => {
  const pr = (exerciseId: string, recordType: string, sessionId: string, date: string): PrEvent => ({ exerciseId, recordType, sessionId, achievedAt: `${date}T12:00:00Z`, date });

  it("treats the first record per exercise/type as a baseline, not a PR", () => {
    const rows = [pr("squat", "estimated_1rm", "a", "2026-10-01"), pr("squat", "max_weight", "a", "2026-10-01"), pr("bench", "estimated_1rm", "a", "2026-10-01")];
    expect(prMoments(rows)).toEqual([]);
    const res = computeAchievements(stats({ prs: rows }), TODAY);
    expect(badge(res, "first-pr").earned).toBe(false);
  });

  it("counts several record types beaten on one exercise in one session as one PR", () => {
    const rows = [
      pr("squat", "estimated_1rm", "a", "2026-10-01"),
      pr("squat", "max_weight", "a", "2026-10-01"),
      pr("squat", "estimated_1rm", "b", "2026-10-05"),
      pr("squat", "max_weight", "b", "2026-10-05"),
      pr("bench", "estimated_1rm", "b", "2026-10-05"),
      pr("squat", "max_weight", "c", "2026-10-09"),
    ];
    expect(prMoments(rows)).toEqual(["2026-10-05", "2026-10-09"]);
    const res = computeAchievements(stats({ prs: rows }), TODAY);
    expect(badge(res, "first-pr")).toMatchObject({ earned: true, earnedAt: "2026-10-05" });
    expect(badge(res, "prs-10").current).toBe(2);
  });
});

describe("volume badges (stored in kg, threshold defined in lb)", () => {
  it("uses 1,000,000 lb expressed in kilograms", () => {
    expect(MILLION_LB_KG).toBeCloseTo(453_592.37, 2);
    expect(kgToLb(MILLION_LB_KG)).toBeCloseTo(1_000_000, 4);
    expect(HUNDRED_K_LB_KG).toBeCloseTo(45_359.237, 3);
  });

  it("is not earned at 1,000,000 kg-short and is earned the day the running total crosses it", () => {
    // 453 sessions of 1000 kg = 453,000 kg < 453,592 kg; the 454th crosses.
    const ws = workouts(454, TODAY, { volumeKg: 1000 });
    const before = computeAchievements(stats({ workouts: ws.slice(0, 453) }), TODAY);
    expect(badge(before, "volume-1m-lb")).toMatchObject({ earned: false, current: 453_000 });
    const after = computeAchievements(stats({ workouts: ws }), TODAY);
    expect(badge(after, "volume-1m-lb")).toMatchObject({ earned: true, earnedAt: ws[453]!.date });
  });

  it("does not treat 1,000,000 kg-in-lb confusion as earned: 453,592 lb of volume is far short", () => {
    const res = volumeProgress([workout(1, "2026-10-01", { volumeKg: 453_592 * 0.45359237 })], MILLION_LB_KG);
    expect(res.earnedAt).toBeNull();
  });

  it("displays progress in the user's units", () => {
    const res = computeAchievements(stats({ workouts: [workout(1, "2026-10-01", { volumeKg: 45_359.237 / 2 })] }), TODAY);
    const b = badge(res, "volume-100k-lb");
    expect(b.unit).toBe("kg");
    expect(displayWeight(b.current, "imperial", 0)).toBe(50_000);
    expect(displayWeight(b.target, "imperial", 0)).toBe(100_000);
    expect(displayWeight(b.target, "metric", 0)).toBe(45_359);
    expect(badgePercent(b)).toBeCloseTo(50, 0);
  });
});

describe("weekly training streaks", () => {
  it("earns on the first workout of the 4th consecutive week", () => {
    // Mondays: Sep 14, 21, 28, Oct 5
    const dates = ["2026-09-15", "2026-09-17", "2026-09-22", "2026-09-30", "2026-10-08"];
    expect(weeklyStreakEarnedAt(dates, 4)).toBe("2026-10-08");
    expect(weeklyStreakEarnedAt(dates, 5)).toBeNull();
  });

  it("restarts the run after a skipped week", () => {
    const dates = ["2026-09-01", "2026-09-08", "2026-09-15", /* gap week of Sep 21 */ "2026-09-29", "2026-10-06", "2026-10-13", "2026-10-15"];
    expect(weeklyStreakEarnedAt(dates, 4)).toBeNull();
    expect(weeklyStreakEarnedAt(dates, 3)).toBe("2026-09-15");
  });

  it("reports the current streak as progress while locked", () => {
    const ws = ["2026-09-30", "2026-10-06", "2026-10-13"].map((d, i) => workout(i, d));
    const b = badge(computeAchievements(stats({ workouts: ws }), TODAY), "streak-4w");
    expect(b).toMatchObject({ earned: false, current: 3, target: 4 });
  });
});

describe("discipline and food", () => {
  it("earns a 7-day discipline streak on the 7th consecutive day; multiple goals per day count once", () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays("2026-10-01", i));
    expect(dailyStreakEarnedAt([...days, ...days], 7)).toBe("2026-10-07");
    expect(dailyStreakEarnedAt([...days.slice(0, 3), ...days.slice(4)], 7)).toBeNull();
    const res = computeAchievements(stats({ disciplineDates: days }), TODAY);
    expect(badge(res, "discipline-7")).toMatchObject({ earned: true, earnedAt: "2026-10-07" });
  });

  it("counts distinct food-logged days", () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays("2026-09-01", i * 3));
    const res = computeAchievements(stats({ foodDays: [...days, days[0]!, days[1]!] }), TODAY);
    expect(badge(res, "food-7")).toMatchObject({ earned: true, earnedAt: days[6] });
    expect(badge(res, "food-30").current).toBe(7);
  });

  it("earns milestones for programs, photos, journal and weigh-ins", () => {
    const res = computeAchievements(
      stats({ programsCompleted: ["2026-09-20"], photoDates: ["2026-10-02", "2026-09-01"], journalDates: ["2026-08-01"], weightDates: Array.from({ length: 10 }, (_, i) => addDays("2026-08-01", i)) }),
      TODAY,
    );
    expect(badge(res, "program-complete")).toMatchObject({ earned: true, earnedAt: "2026-09-20" });
    expect(badge(res, "first-photo")).toMatchObject({ earned: true, earnedAt: "2026-09-01" });
    expect(badge(res, "journal-1")).toMatchObject({ earned: true, earnedAt: "2026-08-01" });
    expect(badge(res, "weigh-ins-10")).toMatchObject({ earned: true, earnedAt: "2026-08-10" });
  });
});

describe("badges unlocked by a workout", () => {
  it("returns only badges this session crossed", () => {
    const ws = workouts(10);
    const res = badgesUnlockedBySession(stats({ workouts: ws }), ws[9]!.sessionId, TODAY).map((b) => b.id);
    expect(res).toEqual(["workouts-10"]);
  });

  it("includes the first workout and its PRs, but not badges earned earlier", () => {
    const first = workouts(1);
    expect(badgesUnlockedBySession(stats({ workouts: first }), first[0]!.sessionId, TODAY).map((b) => b.id)).toEqual(["first-workout"]);

    const ws = workouts(3);
    const prs: PrEvent[] = [
      { exerciseId: "squat", recordType: "max_weight", sessionId: "s0", achievedAt: `${ws[0]!.date}T18:00:00Z`, date: ws[0]!.date },
      { exerciseId: "squat", recordType: "max_weight", sessionId: "s2", achievedAt: `${ws[2]!.date}T18:00:00Z`, date: ws[2]!.date },
    ];
    expect(badgesUnlockedBySession(stats({ workouts: ws, prs }), "s2", TODAY).map((b) => b.id)).toEqual(["first-pr"]);
  });

  it("returns nothing for an ordinary session", () => {
    const ws = workouts(12);
    expect(badgesUnlockedBySession(stats({ workouts: ws }), ws[11]!.sessionId, TODAY)).toEqual([]);
  });
});
