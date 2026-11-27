import { describe, expect, it } from "vitest";
import { MAX_SKIPPABLE_MISSED, missedSessions, planSchedule, type PendingSession } from "@/lib/domain/training-schedule";

const pending: PendingSession[] = Array.from({ length: 9 }, (_, i) => ({ dayId: `d${i + 1}`, week: Math.floor(i / 3) + 1, day: (i % 3) + 1, name: `Session ${i + 1}`, minutes: 45 }));
// 3 days a week: Mon, Wed, Fri. 2026-11-02 is a Monday.
const base = { pending, overrides: {}, daysPerWeek: 3 };

describe("missed program sessions", () => {
  it("nothing is missed before the first workout, or when training is on track", () => {
    expect(missedSessions({ ...base, today: "2026-11-11", lastCompleted: null }).missed).toEqual([]);
    // Trained Monday; today is Wednesday, the next training day: due today, not missed.
    expect(missedSessions({ ...base, today: "2026-11-04", lastCompleted: "2026-11-02" }).missed).toEqual([]);
    // Thursday after a Monday workout: Wednesday's session was missed.
    const r = missedSessions({ ...base, today: "2026-11-05", lastCompleted: "2026-11-02" });
    expect(r.missed.map((m) => [m.dayId, m.wasDue])).toEqual([["d1", "2026-11-04"]]);
    expect(r.resumeAt).toMatchObject({ dayId: "d2", date: "2026-11-06" });
    expect(r.canSkip).toBe(true);
  });

  it("counts every session that has come and gone, and stops offering a skip after a long gap", () => {
    // Last trained Monday 2 Nov; today Monday 16 Nov: Wed 4, Fri 6, Mon 9, Wed 11, Fri 13 missed.
    const r = missedSessions({ ...base, today: "2026-11-16", lastCompleted: "2026-11-02" });
    expect(r.missed.map((m) => m.wasDue)).toEqual(["2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13"]);
    expect(r.missed.length).toBeGreaterThan(MAX_SKIPPABLE_MISSED);
    expect(r.canSkip).toBe(false);
  });

  it("respects the member's own moves: a session moved to a later day isn't missed", () => {
    const r = missedSessions({ ...base, overrides: { d1: "2026-11-07" }, today: "2026-11-05", lastCompleted: "2026-11-02" });
    expect(r.missed).toEqual([]);
  });

  it("never offers to skip the whole rest of the program", () => {
    const short = pending.slice(0, 2);
    const r = missedSessions({ ...base, pending: short, today: "2026-11-09", lastCompleted: "2026-11-02" });
    expect(r.missed).toHaveLength(2);
    expect(r.resumeAt).toBeNull();
    expect(r.canSkip).toBe(false);
  });

  it("after a skip, the session pinned to its usual day is not missed, and the calendar keeps it there", () => {
    // Skipped d1 (due Wed 4); the program resumes at d2 on Fri 6, pinned there.
    const rest = pending.slice(1);
    const input = { ...base, pending: rest, overrides: { d2: "2026-11-06" }, today: "2026-11-05", lastCompleted: "2026-11-02" };
    expect(missedSessions(input).missed).toEqual([]);
    expect(planSchedule(input)[0]).toMatchObject({ dayId: "d2", date: "2026-11-06" });
  });

  it("the calendar itself is unchanged: overdue sessions still roll forward to today until the member chooses", () => {
    const planned = planSchedule({ ...base, today: "2026-11-05", lastCompleted: "2026-11-02" });
    expect(planned[0]).toMatchObject({ dayId: "d1", date: "2026-11-05" });
  });
});
