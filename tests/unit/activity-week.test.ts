import { describe, expect, it } from "vitest";
import { activeMinutes, buildWeeklyActivity } from "@/lib/domain/activity-week";

const item = (id: string, date: string) => ({ id, date, name: "Upper", startedAt: `${date}T10:00:00Z`, minutes: 45 });

describe("weekly activity", () => {
  it("groups sessions into the Monday–Sunday week of today", () => {
    // 2026-10-21 is a Wednesday.
    const w = buildWeeklyActivity(new Date("2026-10-21T15:00:00Z"), "UTC", {
      workouts: [item("a", "2026-10-19"), item("b", "2026-10-21"), item("c", "2026-10-21"), item("old", "2026-10-18")],
    });
    expect(w.weekStart).toBe("2026-10-19");
    expect(w.weekEnd).toBe("2026-10-25");
    expect(w.workouts.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(w.days.map((d) => d.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(w.days.map((d) => d.workouts)).toEqual([1, 0, 2, 0, 0, 0, 0]);
    expect(w.days[2]!.isToday).toBe(true);
    expect(w.days[3]!.isFuture).toBe(true);
    expect(w.runs).toEqual([]);
    expect(w.walks).toEqual([]);
  });
  it("uses the user's time zone for today", () => {
    // 02:00 UTC Monday is still Sunday evening in Los Angeles.
    const w = buildWeeklyActivity(new Date("2026-10-19T02:00:00Z"), "America/Los_Angeles", { workouts: [] });
    expect(w.today).toBe("2026-10-18");
    expect(w.weekStart).toBe("2026-10-12");
  });
  it("excludes paused time from active minutes", () => {
    expect(activeMinutes("2026-10-19T10:00:00Z", "2026-10-19T11:00:00Z", 600)).toBe(50);
    expect(activeMinutes("2026-10-19T10:00:00Z", null, 0)).toBeNull();
  });
});
