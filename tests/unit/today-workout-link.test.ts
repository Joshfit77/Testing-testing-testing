import { describe, expect, it } from "vitest";
import { BLANK_WORKOUT_HREF, todayWorkoutLink } from "@/app/(app)/home/today-workout/link";
import type { ActiveProgram } from "@/server/services/training";

const active = (today: { id: string; name: string } | null) =>
  ({
    userProgramId: "up-1",
    programId: "p-1",
    programSlug: "starter",
    programName: "Starter",
    durationWeeks: 8,
    daysPerWeek: 3,
    currentWeek: 1,
    currentDay: 1,
    weekFocus: null,
    isDeload: false,
    today,
  }) as unknown as ActiveProgram;

describe("today's workout link (Home and Quick add)", () => {
  it("starts the program day when one is due today", () => {
    const link = todayWorkoutLink(active({ id: "day-1", name: "Full Body A" }), { planned: [{ dayId: "day-1", date: "2026-11-09" } as never] }, "2026-11-09");
    expect(link).toEqual({ href: "/train/workout?day=day-1&up=up-1", due: true, name: "Full Body A" });
  });
  it("is due when there is no schedule to say otherwise", () => {
    expect(todayWorkoutLink(active({ id: "day-1", name: "Full Body A" }), null, "2026-11-09").due).toBe(true);
  });
  it("is not due on a rest day (the session is planned for later), but keeps the program link for Start early", () => {
    const link = todayWorkoutLink(active({ id: "day-1", name: "Full Body A" }), { planned: [{ dayId: "day-1", date: "2026-11-10" } as never] }, "2026-11-09");
    expect(link.due).toBe(false);
    expect(link.href).toBe("/train/workout?day=day-1&up=up-1");
  });
  it("falls back to an empty workout without a program or a next day", () => {
    expect(todayWorkoutLink(null, null, "2026-11-09")).toEqual({ href: BLANK_WORKOUT_HREF, due: false, name: null });
    expect(todayWorkoutLink(active(null), null, "2026-11-09")).toEqual({ href: BLANK_WORKOUT_HREF, due: false, name: null });
  });
});
