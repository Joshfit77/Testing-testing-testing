import { buildCalendar, monthGrid, shiftMonth } from "@/lib/domain/calendar";
import { planSchedule } from "@/lib/domain/training-schedule";

const TODAY = "2026-10-21"; // Wednesday
const planned = planSchedule({
  pending: [
    { dayId: "d1", week: 1, day: 1, name: "Upper", minutes: 50 },
    { dayId: "d2", week: 1, day: 2, name: "Lower", minutes: 50 },
  ],
  overrides: { d1: "2026-10-22" },
  today: TODAY,
  daysPerWeek: 3,
});

describe("training calendar merge", () => {
  const days = buildCalendar(
    {
      workouts: [{ id: "w1", date: "2026-10-19", name: "Full Body", minutes: 48 }],
      runs: [{ id: "r1", date: "2026-10-19", name: "Run", minutes: 30, distanceM: 5000 }],
      walks: [{ id: "k1", date: "2026-10-20", name: "Walk", minutes: 20, distanceM: 1609.344 }],
      planned,
      hasProgram: true,
    },
    { from: "2026-10-19", to: "2026-10-25" },
    TODAY,
    "imperial",
  );
  const on = (d: string) => days.find((x) => x.date === d)!.entries;

  it("keeps completed workouts, runs and walks on the day they happened", () => {
    expect(on("2026-10-19").map((e) => e.kind)).toEqual(["workout", "run"]);
    expect(on("2026-10-19")[0]).toMatchObject({ title: "Full Body", href: "/train/history/w1", detail: "48 min" });
    expect(on("2026-10-19")[1]).toMatchObject({ href: "/run/activities/r1", detail: "3.11 mi · 30 min" });
    expect(on("2026-10-20")[0]).toMatchObject({ kind: "walk", detail: "1.00 mi · 20 min" });
  });

  it("places planned sessions on their (moved) dates", () => {
    expect(on("2026-10-22")).toEqual([expect.objectContaining({ kind: "planned", title: "Upper", planned: expect.objectContaining({ moved: true, defaultDate: TODAY }) })]);
    expect(on("2026-10-23")[0]).toMatchObject({ kind: "planned", title: "Lower" });
  });

  it("marks rest days only from today up to the last planned session", () => {
    expect(on(TODAY).map((e) => e.kind)).toEqual(["rest"]);
    expect(on("2026-10-20").map((e) => e.kind)).toEqual(["walk"]);
    expect(on("2026-10-24")).toEqual([]); // after the last planned session
    expect(days.find((d) => d.date === TODAY)).toMatchObject({ isToday: true, isPast: false });
  });

  it("shows no rest days without an active program", () => {
    const none = buildCalendar({ workouts: [], runs: [], walks: [], planned: [], hasProgram: false }, { from: TODAY, to: "2026-10-25" }, TODAY);
    expect(none.every((d) => d.entries.length === 0)).toBe(true);
  });

  it("builds a Monday-first month grid", () => {
    expect(monthGrid("2026-10")).toEqual({ from: "2026-09-28", to: "2026-11-01", first: "2026-10-01", last: "2026-10-31" });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
