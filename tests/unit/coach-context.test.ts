import { describe, expect, it } from "vitest";
import { adherence, bodyweightTrend, formatAthleteContext, liftTrends, suggestedQuestions, topSet } from "@/lib/coach/context";
import { athleteFixture, emptyAthlete } from "./fixtures/coach-fixtures";

describe("coach context builder", () => {
  it("summarizes goal, budget, today's intake, program, workouts, trends, PRs and other signals", () => {
    const text = formatAthleteContext(athleteFixture());
    expect(text).toContain("Today: 2026-10-19. Units: kg/cm.");
    expect(text).toContain("Goal: build strength, experience intermediate");
    expect(text).toContain("goal weight 80 kg");
    expect(text).toContain("chosen pace -0.25 kg/week");
    expect(text).toContain("Diet type: high protein.");
    expect(text).toContain("maintenance 2600 kcal, goal 2330 kcal");
    expect(text).toContain("Today's food so far: 900 kcal");
    expect(text).toContain("1430 kcal and 115 g protein left");
    expect(text).toContain("Last 7 days food: 3/7 days logged");
    expect(text).toMatch(/Active program: Strength Builder \(starter, user's own/);
    expect(text).toContain("week 3/8");
    expect(text).toContain("- Day 2 Bench day (Upper) ← next: Bench Press [bench-press] 4×5 @RPE 8");
    expect(text).toContain("Plank [plank] 3×45s");
    // Top set with e1RM, skips with reasons.
    expect(text).toContain("- 2026-10-17 Bench day: Bench Press 2s top 100 kg×4 @9 [113.3 kg]; Barbell Row skipped (pain)");
    expect(text).toMatch(/e1RM trends: .*Bench Press 116\.7 kg→113\.3 kg \(-2\.9% over 3 sessions, no new best in 2 sessions\)/);
    expect(text).toContain("Best e1RMs: Bench Press 116.7 kg (2026-10-08).");
    expect(text).toMatch(/Bodyweight trend: 83 kg now, -1 kg over 24 days/);
    expect(text).toMatch(/Consistency: 5 sessions in the last 28 days of ~12 planned \(42%\)/);
    expect(text).toContain("Steps: avg 8,000/day over 2 logged days (goal 8,000).");
    expect(text).toContain("Supplement stack: Creatine monohydrate.");
    expect(text).toContain("Latest readiness check-in: 72/100");
  });

  it("uses imperial units when the athlete prefers them", () => {
    const text = formatAthleteContext(athleteFixture({ units: "imperial" }));
    expect(text).toContain("Units: lb/in.");
    expect(text).toContain("220.5 lb×4");
    expect(text).toContain(`5'10"`);
  });

  it("handles a brand-new user without inventing data", () => {
    const text = formatAthleteContext(emptyAthlete());
    expect(text).toContain("Active program: none.");
    expect(text).toContain("Workouts: none logged yet.");
    expect(text).toContain("Today's food: nothing logged yet.");
    expect(text).toContain("Supplement stack: none.");
    expect(text).not.toContain("e1RM trends");
    expect(text).not.toContain("Bodyweight");
  });

  it("only includes limitations when they were provided (consented upstream)", () => {
    expect(formatAthleteContext(athleteFixture())).not.toContain("limitations");
    expect(formatAthleteContext(athleteFixture({ limitations: "Old knee injury" }))).toContain("Self-reported limitations (consented; don't diagnose): Old knee injury");
  });

  it("mentions a library program can't be edited and a deload week", () => {
    const base = athleteFixture();
    const text = formatAthleteContext({ ...base, program: { ...base.program!, source: "curated", editable: false, isDeload: true } });
    expect(text).toContain("library program — can't be edited; swaps happen in the workout logger");
    expect(text).toContain("(deload week)");
  });

  it("keeps the block compact (token budget) even with many workouts", () => {
    const base = athleteFixture();
    const many = Array.from({ length: 30 }, (_, i) => ({ ...base.workouts[0]!, date: `2026-09-${String(i + 1).padStart(2, "0")}` }));
    const text = formatAthleteContext({ ...base, workouts: many });
    expect(text.split("\n").filter((l) => l.startsWith("- 2026-09")).length).toBe(10);
    expect(text.length).toBeLessThan(5000);
  });
});

describe("context helpers", () => {
  it("picks the top set by estimated 1RM", () => {
    const t = topSet([
      { reps: 8, weightKg: 90, seconds: null, rpe: 8 },
      { reps: 3, weightKg: 105, seconds: null, rpe: 9 },
    ]);
    expect(t?.weightKg).toBe(105);
    expect(t?.e1rmKg).toBe(115.5);
    expect(topSet([])).toBeNull();
  });

  it("computes lift trends and stalls", () => {
    const trends = liftTrends(athleteFixture().workouts);
    const bench = trends.find((t) => t.slug === "bench-press")!;
    expect(bench.sessions).toBe(3);
    expect(bench.sessionsSinceBest).toBe(2);
    expect(bench.changePct).toBeLessThan(0);
    const squat = trends.find((t) => t.slug === "back-squat")!;
    expect(squat.changePct).toBeGreaterThan(0);
    expect(squat.sessionsSinceBest).toBe(0);
  });

  it("computes bodyweight trend per week", () => {
    const bw = bodyweightTrend(
      [
        { date: "2026-10-05", kg: 84 },
        { date: "2026-10-19", kg: 83 },
      ],
      "2026-10-19",
    );
    expect(bw).toEqual({ latestKg: 83, changeKg: -1, perWeekKg: -0.5, days: 14 });
    expect(bodyweightTrend([], "2026-10-19")).toBeNull();
  });

  it("computes adherence and streaks", () => {
    const a = adherence(["2026-10-13", "2026-10-15", "2026-10-17", "2026-10-18", "2026-10-19"], "2026-10-19", 3);
    expect(a.last28).toBe(5);
    expect(a.planned).toBe(12);
    expect(a.dayStreak).toBe(3);
    expect(a.lastSession).toBe("2026-10-19");
  });

  it("builds starter questions from the athlete's data", () => {
    const q = suggestedQuestions(athleteFixture());
    expect(q[0]).toBe("Why did my bench press stall?");
    expect(q).toContain("What should I eat before today's Bench day workout?");
    expect(q).toContain("Plan my deload");
    expect(q.length).toBeLessThanOrEqual(6);
    const fresh = suggestedQuestions(emptyAthlete());
    expect(fresh).toContain("What should I eat before my workout today?");
    expect(fresh).toContain("How should I start if I'm new to lifting?");
  });
});
