import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";
import { sleepTrainingLinks } from "@/lib/domain/sleep-training";

const night = (date: string, asleep: number): SleepSession => ({ id: date, kind: "night", source: "manual", startedAt: `${date}T00:00:00Z`, endedAt: new Date(Date.parse(`${date}T00:00:00Z`) + asleep * 60_000).toISOString(), timezone: "UTC", nightOf: date });
const checkin = (day: string, restedness: number): SleepCheckin => ({ day, restedness, energy_morning: null, energy_afternoon: null, energy_evening: null, mood: null, stress: null, sleep_quality: null, caffeine_last: null, alcohol: null, late_meal: null, exercise_timing: null, evening_screens: null, disturbances: [], travel: null, sleep_aid: null, notes: null });
const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(10 + i).padStart(2, "0")}`);

describe("sleep and training links", () => {
  it("compares nights before training with other nights, effort and restedness after short nights", () => {
    // Even days: training days with short nights before them and harder sessions; odd days: rest, good sleep.
    const nights = summarizeNights(days.map((d, i) => night(d, i % 2 === 0 ? 360 : 480)));
    const training = days.filter((_, i) => i % 2 === 0).map((d) => ({ date: d, avgRpe: 8.5, sets: 12 }));
    const trainingAll = [...training, ...days.filter((_, i) => i % 2 === 1).map((d) => ({ date: d, avgRpe: 7.5, sets: 10 }))];
    const checkins = days.map((d, i) => checkin(d, i % 2 === 0 ? 2 : 4));
    const links = sleepTrainingLinks(nights, trainingAll, checkins, 480);
    expect(links.map((l) => l.key)).toEqual(["effort_after_sleep", "restedness_after_sleep"]);
    expect(links[0]!.text).toContain("1 RPE harder");
    expect(links[1]!.text).toContain("2.0 out of 5");
    const before = sleepTrainingLinks(nights, training, checkins, 480);
    expect(before[0]!.key).toBe("night_before_training");
    expect(before[0]!.text).toContain("2h less");
    for (const l of [...links, ...before]) expect(l.text).not.toMatch(/because|causes/i);
  });

  it("says nothing with fewer than three on a side or no real difference", () => {
    const nights = summarizeNights(days.map((d) => night(d, 480)));
    const training = days.slice(0, 2).map((d) => ({ date: d, avgRpe: 8, sets: 10 }));
    expect(sleepTrainingLinks(nights, training, [], 480)).toEqual([]);
    const even = summarizeNights(days.map((d, i) => night(d, i % 2 ? 470 : 480)));
    expect(sleepTrainingLinks(even, days.map((d) => ({ date: d, avgRpe: 8, sets: 10 })), [], 480)).toEqual([]);
  });
});
