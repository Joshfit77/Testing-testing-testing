import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import type { SleepCheckin } from "@/lib/domain/sleep-checkins";
import { sleepTrainingLinks } from "@/lib/domain/sleep-training";

const night = (date: string, asleep: number): SleepSession => ({ id: date, kind: "night", source: "manual", startedAt: `${date}T00:00:00Z`, endedAt: new Date(Date.parse(`${date}T00:00:00Z`) + asleep * 60_000).toISOString(), timezone: "UTC", nightOf: date });
const checkin = (day: string, restedness: number): SleepCheckin => ({ day, restedness, energy_morning: null, energy_afternoon: null, energy_evening: null, mood: null, stress: null, sleep_quality: null, caffeine_last: null, alcohol: null, late_meal: null, exercise_timing: null, evening_screens: null, disturbances: [], travel: null, sleep_aid: null, notes: null });
const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(10 + i).padStart(2, "0")}`);
const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

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

  it("compares readiness after steady and off-schedule bedtimes, from the member's own check-ins", () => {
    // Seven nights to bed at 23:00, three at 01:00 (two hours off the typical bedtime).
    const sessions: SleepSession[] = days.map((d, i) => {
      const bed = i < 7 ? `${addDaysIso(d, -1)}T23:00:00Z` : `${d}T01:00:00Z`;
      return { id: d, kind: "night", source: "manual", startedAt: bed, endedAt: `${d}T07:00:00Z`, timezone: "UTC", nightOf: d };
    });
    const readiness = days.map((d, i) => ({ date: d, readiness: i < 7 ? 80 : 58 }));
    const links = sleepTrainingLinks(summarizeNights(sessions), [], [], 480, readiness);
    expect(links.map((l) => l.key)).toEqual(["readiness_after_steady_bedtime"]);
    expect(links[0]!.text).toContain("80 out of 100 (7 mornings)");
    expect(links[0]!.text).toContain("58 after a bedtime more than 60 minutes off it (3)");
    expect(links[0]!.text).not.toMatch(/because|causes/i);
    // Without readiness check-ins there is nothing to compare.
    expect(sleepTrainingLinks(summarizeNights(sessions), [], [], 480)).toEqual([]);
  });

  it("compares readiness after nights the watch recorded a higher-than-usual overnight heart rate", () => {
    const recorded = (d: string, hr: number): SleepSession => ({
      id: d,
      kind: "night",
      source: "apple_health",
      startedAt: `${addDaysIso(d, -1)}T23:00:00Z`,
      endedAt: `${d}T07:00:00Z`,
      timezone: "UTC",
      nightOf: d,
      deviceName: "Apple Watch",
      vitals: { heartRate: { avg: hr, min: hr - 6, max: hr + 10, samples: 400 }, hrv: null, respiratoryRate: null },
    });
    // Six usual nights at 52 bpm, four at 60 bpm (the usual over all ten is 55.2, so 60 is "higher than usual").
    const sessions = days.map((d, i) => recorded(d, i % 5 === 0 || i % 5 === 1 ? 60 : 52));
    const readiness = days.map((d, i) => ({ date: d, readiness: i % 5 === 0 || i % 5 === 1 ? 55 : 78 }));
    const links = sleepTrainingLinks(summarizeNights(sessions), [], [], 480, readiness);
    expect(links.map((l) => l.key)).toEqual(["readiness_after_overnight_hr"]);
    expect(links[0]!.text).toContain("at least 4 bpm above your usual 55 bpm");
    expect(links[0]!.text).toContain("55 out of 100 (4 mornings)");
    expect(links[0]!.text).toContain("78 after the other recorded nights (6)");
    expect(links[0]!.text).toContain("device's reading");
    // Hand-entered nights carry no readings, so the comparison never appears for them.
    const manual = summarizeNights(days.map((d) => night(d, 480)));
    expect(sleepTrainingLinks(manual, [], [], 480, readiness)).toEqual([]);
  });

  it("says nothing with fewer than three on a side or no real difference", () => {
    const nights = summarizeNights(days.map((d) => night(d, 480)));
    const training = days.slice(0, 2).map((d) => ({ date: d, avgRpe: 8, sets: 10 }));
    expect(sleepTrainingLinks(nights, training, [], 480)).toEqual([]);
    const even = summarizeNights(days.map((d, i) => night(d, i % 2 ? 470 : 480)));
    expect(sleepTrainingLinks(even, days.map((d) => ({ date: d, avgRpe: 8, sets: 10 })), [], 480)).toEqual([]);
  });
});
