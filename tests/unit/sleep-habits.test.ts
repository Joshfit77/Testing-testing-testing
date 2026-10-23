import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";
import { allSleepTips, sleepTips, type HabitInputs } from "@/lib/domain/sleep-habits";
import { sleepWindows } from "@/lib/domain/sleep-schedule";

const empty = (day: string): SleepCheckin => ({ day, restedness: null, energy_morning: null, energy_afternoon: null, energy_evening: null, mood: null, stress: null, sleep_quality: null, caffeine_last: null, alcohol: null, late_meal: null, exercise_timing: null, evening_screens: null, disturbances: [], travel: null, sleep_aid: null, notes: null });
const night = (date: string, bed: string, wake: string): SleepSession => ({ id: date, kind: "night", source: "manual", startedAt: bed, endedAt: wake, timezone: "UTC", nightOf: date });
const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];

function inputs(over: Partial<HabitInputs> = {}): HabitInputs {
  const nights = summarizeNights(days.map((d) => night(d, `${d}T00:30:00Z`, `${d}T06:00:00Z`)));
  return { nights, naps: [], checkins: [], goalMinutes: 480, debtMinutes: null, windows: sleepWindows(nights, 480), dismissed: [], ...over };
}

describe("sleep habit tips v1", () => {
  it("suggests an earlier bedtime for short, late nights, with the evidence", () => {
    const tips = allSleepTips(inputs());
    const t = tips.find((x) => x.key === "earlier_bedtime")!;
    expect(t.why).toContain("5h 30m against a 8h goal");
    expect(t.action).toContain("15 minutes earlier");
  });

  it("reads habits from check-ins and never mentions medication", () => {
    const checkins = days.map((d, i) => ({ ...empty(d), caffeine_last: i < 3 ? "16:00" : "09:00", evening_screens: true, late_meal: i % 2 === 0, disturbances: i < 2 ? (["noise"] as const).slice() : [] }));
    const keys = allSleepTips(inputs({ checkins })).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(["late_caffeine", "evening_screens", "late_meals", "environment"]));
    for (const t of allSleepTips(inputs({ checkins }))) expect(`${t.why} ${t.action}`).not.toMatch(/medic|pill|melatonin/i);
  });

  it("caps at three and hides dismissed tips", () => {
    const checkins = days.map((d) => ({ ...empty(d), caffeine_last: "16:00", evening_screens: true, late_meal: true }));
    const shown = sleepTips(inputs({ checkins, debtMinutes: 300 }));
    expect(shown).toHaveLength(3);
    const without = sleepTips(inputs({ checkins, debtMinutes: 300, dismissed: [shown[0]!.key, shown[1]!.key] }));
    expect(without.map((t) => t.key)).not.toContain(shown[0]!.key);
    expect(without).toHaveLength(3);
  });

  it("stays quiet when there is nothing to say", () => {
    const nights = summarizeNights(days.map((d) => night(d, `${d}T00:00:00Z`.replace("T00:00", "T00:00"), `${d}T08:10:00Z`)));
    expect(sleepTips(inputs({ nights, windows: sleepWindows(nights, 480) }))).toEqual([]);
  });
});
