import { checkMove, nextTrainingDay, planSchedule, type PendingSession } from "@/lib/domain/training-schedule";

// 2026-10-21 is a Wednesday. Three days a week → Mon / Wed / Fri.
const TODAY = "2026-10-21";
const pending: PendingSession[] = [
  { dayId: "d1", week: 1, day: 1, name: "Full Body A", minutes: 45 },
  { dayId: "d2", week: 1, day: 2, name: "Full Body B", minutes: 45 },
  { dayId: "d3", week: 1, day: 3, name: "Full Body C", minutes: 45 },
  { dayId: "d4", week: 2, day: 1, name: "Full Body A", minutes: 45 },
];
const plan = (overrides: Record<string, string> = {}, completedToday = false) => planSchedule({ pending, overrides, today: TODAY, daysPerWeek: 3, completedToday });

describe("planned session dates", () => {
  it("puts the next session today and the rest on the usual training days", () => {
    expect(plan().map((s) => s.date)).toEqual(["2026-10-21", "2026-10-23", "2026-10-26", "2026-10-28"]);
    expect(plan().every((s) => !s.moved)).toBe(true);
  });

  it("plans the next session for the next training day once a workout was done today", () => {
    expect(plan({}, true)[0]!.date).toBe("2026-10-23");
  });

  it("an override moves a planned session, and later ones flow after it", () => {
    const s = plan({ d1: "2026-10-22" });
    expect(s[0]).toMatchObject({ dayId: "d1", date: "2026-10-22", defaultDate: "2026-10-21", moved: true });
    expect(s.map((x) => x.date)).toEqual(["2026-10-22", "2026-10-23", "2026-10-26", "2026-10-28"]);
    expect(plan({ d1: "2026-10-24" }).map((x) => x.date)).toEqual(["2026-10-24", "2026-10-26", "2026-10-28", "2026-10-30"]);
  });

  it("never moves a completed session: overrides for days no longer pending are ignored", () => {
    // d0 was completed (it's before the program pointer, so it isn't pending); its stale override does nothing.
    const s = plan({ d0: "2026-10-30" });
    expect(s.map((x) => x.dayId)).toEqual(["d1", "d2", "d3", "d4"]);
    expect(s.map((x) => x.date)).toEqual(plan().map((x) => x.date));
  });

  it("an overdue moved session rolls forward to today and dates never go backwards", () => {
    expect(plan({ d1: "2026-10-19" })[0]!.date).toBe(TODAY);
    expect(plan({ d1: "2026-10-26", d2: "2026-10-22" }).map((x) => x.date).slice(0, 2)).toEqual(["2026-10-26", "2026-10-26"]);
  });

  it("finds the next default training day", () => {
    expect(nextTrainingDay("2026-10-23", 3)).toBe("2026-10-26");
    expect(nextTrainingDay("2026-10-21", 7)).toBe("2026-10-22");
  });
});

describe("checking a move", () => {
  const s = plan();
  it("accepts a later date and refuses past dates, completed sessions and out-of-order moves", () => {
    expect(checkMove(s, {}, "d1", "2026-10-22", TODAY)).toEqual({ ok: true, store: "2026-10-22", clear: [] });
    expect(checkMove(s, {}, "d1", "2026-10-20", TODAY)).toMatchObject({ ok: false });
    expect(checkMove(s, {}, "d0", "2026-10-22", TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/Completed workouts stay/) });
    expect(checkMove(s, {}, "d3", "2026-10-22", TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/program order/) });
    expect(checkMove(s, {}, "d1", "2027-06-01", TODAY)).toMatchObject({ ok: false });
    expect(checkMove(s, {}, "d1", "not-a-date", TODAY)).toMatchObject({ ok: false });
  });

  it("moving back to the usual day removes the override", () => {
    const moved = plan({ d2: "2026-10-24" });
    expect(checkMove(moved, { d2: "2026-10-24" }, "d2", "2026-10-23", TODAY)).toEqual({ ok: true, store: null, clear: [] });
  });

  it("drops later overrides that would now fall before the moved session", () => {
    const o = { d3: "2026-10-27" };
    expect(checkMove(plan(o), o, "d1", "2026-10-29", TODAY)).toEqual({ ok: true, store: "2026-10-29", clear: ["d3"] });
  });
});
