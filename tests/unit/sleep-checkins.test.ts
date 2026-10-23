import { summarizeNights, type SleepSession } from "@/lib/domain/sleep";
import { associations, clockToMinutes, describeAssociation, factorPresent, isEmptyCheckin, type Disturbance, type SleepCheckin } from "@/lib/domain/sleep-checkins";

const empty = (day: string): SleepCheckin => ({
  day,
  restedness: null,
  energy_morning: null,
  energy_afternoon: null,
  energy_evening: null,
  mood: null,
  stress: null,
  sleep_quality: null,
  caffeine_last: null,
  alcohol: null,
  late_meal: null,
  exercise_timing: null,
  evening_screens: null,
  disturbances: [],
  travel: null,
  sleep_aid: null,
  notes: null,
});
const night = (date: string, asleepMinutes: number): SleepSession => ({
  id: date,
  kind: "night",
  source: "manual",
  startedAt: `${date}T00:00:00Z`,
  endedAt: new Date(Date.parse(`${date}T00:00:00Z`) + asleepMinutes * 60_000).toISOString(),
  timezone: "UTC",
  nightOf: date,
});

describe("check-in fields", () => {
  it("knows an empty check-in and reads clock times", () => {
    expect(isEmptyCheckin(empty("2026-10-23"))).toBe(true);
    expect(isEmptyCheckin({ ...empty("2026-10-23"), alcohol: false })).toBe(false);
    expect(clockToMinutes("14:30")).toBe(870);
    expect(clockToMinutes("9:05:00")).toBe(545);
    expect(clockToMinutes(null)).toBeNull();
    expect(clockToMinutes("late")).toBeNull();
  });
  it("derives factors, leaving unanswered ones as null", () => {
    const c = { ...empty("2026-10-23"), caffeine_last: "15:00", exercise_timing: "evening" as const, disturbances: ["noise" as const] };
    expect(factorPresent(c, "late_caffeine")).toBe(true);
    expect(factorPresent({ ...c, caffeine_last: "11:00" }, "late_caffeine")).toBe(false);
    expect(factorPresent(c, "alcohol")).toBeNull();
    expect(factorPresent(c, "evening_exercise")).toBe(true);
    expect(factorPresent(c, "disturbed")).toBe(true);
    expect(factorPresent(empty("2026-10-23"), "disturbed")).toBeNull();
  });
});

describe("associations", () => {
  const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(10 + i).padStart(2, "0")}`);
  it("needs three nights on each side and a real difference, and never claims a cause", () => {
    // Alcohol on 4 nights (shorter sleep, lower restedness), none on 6.
    const sessions = days.map((d, i) => night(d, i < 4 ? 390 : 450));
    const checkins = days.map((d, i) => ({ ...empty(d), alcohol: i < 4, restedness: i < 4 ? 2 : 4, late_meal: false }));
    const out = associations(summarizeNights(sessions), checkins);
    expect(out.map((a) => a.key)).toEqual(["alcohol"]);
    expect(out[0]).toMatchObject({ withCount: 4, withoutCount: 6, asleepDeltaMinutes: -60, restednessDelta: -2 });
    const text = describeAssociation(out[0]!);
    expect(text).toContain("On 4 nights after alcohol, you slept 60 min less and felt less rested (2 points) than on 6 nights without.");
    expect(text).toContain("not proof of a cause");
    expect(text).not.toMatch(/because/i);
  });
  it("skips factors with too few nights or no meaningful difference", () => {
    const sessions = days.map((d) => night(d, 450));
    const two = days.map((d, i) => ({ ...empty(d), alcohol: i < 2, late_meal: i % 2 === 0 }));
    expect(associations(summarizeNights(sessions), two)).toEqual([]);
  });
  it("treats a check-in with no disturbance noted as a night without one", () => {
    const sessions = days.map((d, i) => night(d, i < 3 ? 360 : 450));
    const checkins = days.map((d, i) => ({ ...empty(d), disturbances: i < 3 ? (["noise"] as Disturbance[]) : [] }));
    const out = associations(summarizeNights(sessions), checkins);
    expect(out[0]).toMatchObject({ key: "disturbed", withCount: 3, withoutCount: 7, asleepDeltaMinutes: -90, restednessDelta: null });
  });
});
