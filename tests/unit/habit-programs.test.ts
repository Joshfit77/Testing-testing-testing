import { describe, expect, it } from "vitest";
import { activitiesForDay, habitDayNumber, habitProgress, validateHabitProgram, type HabitProgram } from "@/lib/domain/habit-programs";

const program: HabitProgram = {
  slug: "test-habits",
  name: "Test",
  summary: "s",
  description: "d",
  category: "nutrition",
  level: "beginner",
  days: 14,
  schedule: "Daily",
  equipment: [],
  instructions: ["Do it"],
  goalFields: [{ key: "protein", label: "Protein", unit: "g", min: 40, max: 250, default: 120, help: "h" }],
  completion: { minShare: 0.8, text: "80%" },
  weeks: [1, 2].map((week) => ({
    week,
    title: `Week ${week}`,
    objective: "o",
    lesson: { title: "l", body: ["b"] },
    milestone: "m",
    daily: [
      { key: "log", kind: "track_food", title: "Log food" },
      { key: "walk", kind: "walk", title: "Walk", onDays: [1, 3, 5] },
      { key: "pray", kind: "prayer", title: "Pray", optional: true },
    ],
    weekly: [{ key: "plan", kind: "meal_plan", title: "Plan meals" }],
  })),
};

describe("habit programs", () => {
  it("validates structure, including that faith activities are optional", () => {
    expect(validateHabitProgram(program)).toEqual([]);
    const bad = { ...program, weeks: program.weeks.map((w) => ({ ...w, daily: [{ key: "read", kind: "scripture" as const, title: "Read" }] })) };
    expect(validateHabitProgram(bad).join(" ")).toMatch(/must be optional/);
    expect(validateHabitProgram({ ...program, days: 21 }).join(" ")).toMatch(/3 needed/);
  });

  it("lists the day's activities by weekday", () => {
    expect(activitiesForDay(program, 1).daily.map((a) => a.key)).toEqual(["log", "walk", "pray"]);
    expect(activitiesForDay(program, 2).daily.map((a) => a.key)).toEqual(["log", "pray"]);
    expect(activitiesForDay(program, 15).daily).toEqual([]);
    expect(habitDayNumber("2026-11-01", "2026-10-31")).toBe(0);
    expect(habitDayNumber("2026-11-01", "2026-11-03")).toBe(3);
  });

  it("progress counts required items only; a missed day stays missed and nothing restarts", () => {
    // Day 3: log ×3, walk on days 1 and 3, weekly plan once = 6 required items.
    const p = habitProgress(program, "2026-11-01", "2026-11-03", [
      { day_number: 1, activity_key: "log" },
      { day_number: 1, activity_key: "walk" },
      { day_number: 2, activity_key: "plan" },
      { day_number: 3, activity_key: "pray" },
    ]);
    expect(p).toMatchObject({ currentDay: 3, required: 6, done: 3, finished: false, complete: false });
    // After the end, 80% of all required items completes it.
    const all = [];
    for (let d = 1; d <= 14; d++) {
      all.push({ day_number: d, activity_key: "log" });
      if ([1, 3, 5, 8, 10, 12].includes(d)) all.push({ day_number: d, activity_key: "walk" });
    }
    all.push({ day_number: 2, activity_key: "plan" });
    const done = habitProgress(program, "2026-11-01", "2026-11-20", all.slice(2));
    expect(done.finished).toBe(true);
    expect(done.totalRequired).toBe(22);
    expect(done.complete).toBe(true);
    expect(habitProgress(program, "2026-11-01", "2026-11-20", all.slice(8)).complete).toBe(false);
  });
});
