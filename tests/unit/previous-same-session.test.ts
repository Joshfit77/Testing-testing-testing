import { describe, expect, it } from "vitest";
import { latestPerformances, preferSameSession, type PreviousRow } from "@/lib/domain/previous-performance";

const set = (weight: number, reps: number) => ({ set_number: 1, reps, weight_kg: weight, duration_seconds: null, distance_m: null, is_warmup: false, completed: true });

function row(id: string, startedAt: string, weight: number, reps: number, day?: { n: number; program: string; deload?: boolean }): PreviousRow {
  return {
    exercise_id: "bench",
    skipped: false,
    session: {
      id,
      started_at: startedAt,
      status: "completed",
      program_day: day ? { day_number: day.n, week: { program_id: day.program, is_deload: day.deload ?? false } } : null,
    },
    sets: [set(weight, reps)],
  };
}

// Heavy day (day 1, triples at 100 kg) and volume day (day 3, sets of 10 at 70 kg) of the same program.
const heavy = row("s1", "2026-10-26T10:00:00Z", 100, 3, { n: 1, program: "p" });
const volume = row("s2", "2026-10-28T10:00:00Z", 70, 10, { n: 3, program: "p" });

describe("last time prefers the same day of the program", () => {
  it("a heavy day takes last week's heavy day, not the more recent volume day", () => {
    const got = preferSameSession([heavy, volume], { programId: "p", dayNumber: 1 }).get("bench")!;
    expect(got.sessionId).toBe("s1");
    expect(got.sets[0]).toMatchObject({ weightKg: 100, reps: 3 });
  });

  it("without a program day it is the plain latest session (unchanged behaviour)", () => {
    expect(preferSameSession([heavy, volume], null).get("bench")!.sessionId).toBe("s2");
    expect(preferSameSession([heavy, volume], null)).toEqual(latestPerformances([heavy, volume]));
  });

  it("falls back to the latest session anywhere when this day was never done", () => {
    expect(preferSameSession([heavy, volume], { programId: "p", dayNumber: 5 }).get("bench")!.sessionId).toBe("s2");
  });

  it("day numbers only match within the same program", () => {
    const other = row("s3", "2026-10-30T10:00:00Z", 40, 12, { n: 1, program: "other" });
    expect(preferSameSession([heavy, volume, other], { programId: "p", dayNumber: 1 }).get("bench")!.sessionId).toBe("s1");
  });

  it("a deload session never sets the numbers for a normal week (and a deload prefers the last deload)", () => {
    const deload = row("s4", "2026-11-02T10:00:00Z", 60, 3, { n: 1, program: "p", deload: true });
    expect(preferSameSession([heavy, volume, deload], { programId: "p", dayNumber: 1 }).get("bench")!.sessionId).toBe("s1");
    expect(preferSameSession([heavy, volume, deload], { programId: "p", dayNumber: 1, deload: true }).get("bench")!.sessionId).toBe("s4");
  });

  it("still excludes the session being edited and skipped or unfinished sessions", () => {
    const skipped = { ...row("s5", "2026-11-03T10:00:00Z", 105, 3, { n: 1, program: "p" }), skipped: true };
    const open = { ...row("s6", "2026-11-03T11:00:00Z", 110, 3, { n: 1, program: "p" }), session: { ...heavy.session!, id: "s6", started_at: "2026-11-03T11:00:00Z", status: "in_progress" } };
    expect(preferSameSession([heavy, skipped, open], { programId: "p", dayNumber: 1 }).get("bench")!.sessionId).toBe("s1");
    expect(preferSameSession([heavy, volume], { programId: "p", dayNumber: 1 }, "s1").get("bench")!.sessionId).toBe("s2");
  });
});
