import { describe, expect, it } from "vitest";
import { buildDatedFaithNotifications, buildFaithNotifications, inQuietHours, instantInZone, todayIdsToCancel, type FaithReminder, type FaithReminderContext } from "@/lib/faith-reminders";

const every = [0, 1, 2, 3, 4, 5, 6] as FaithReminder["weekdays"];
const on = (kind: FaithReminder["kind"], time: string, weekdays = every): FaithReminder => ({ kind, enabled: true, time, weekdays });
const none = { reading: false, prayer: false, challenge: false, fitness: false };
const ctx = (over: Partial<FaithReminderContext> = {}): FaithReminderContext => ({ today: "2026-11-03", timezone: "America/New_York", now: new Date("2026-11-03T10:00:00Z"), done: none, journeyActive: true, quiet: null, ...over });

describe("time zones and DST", () => {
  it("turns a local time into the right instant, on both sides of a DST change", () => {
    // New York: EDT (UTC−4) until 2026-11-01 02:00, EST (UTC−5) after; EST until 2026-03-08 02:00.
    expect(instantInZone("2026-10-31", "21:00", "America/New_York").toISOString()).toBe("2026-11-01T01:00:00.000Z");
    expect(instantInZone("2026-11-01", "21:00", "America/New_York").toISOString()).toBe("2026-11-02T02:00:00.000Z");
    expect(instantInZone("2026-03-07", "07:00", "America/New_York").toISOString()).toBe("2026-03-07T12:00:00.000Z");
    expect(instantInZone("2026-03-08", "07:00", "America/New_York").toISOString()).toBe("2026-03-08T11:00:00.000Z");
    // A time that doesn't exist on the spring-forward day moves an hour later rather than being lost.
    expect(instantInZone("2026-03-08", "02:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(instantInZone("2026-11-03", "23:00", "Pacific/Auckland").toISOString()).toBe("2026-11-03T10:00:00.000Z");
    expect(instantInZone("2026-11-03", "08:15", "UTC").toISOString()).toBe("2026-11-03T08:15:00.000Z");
  });

  it("keeps the same wall-clock time every day across a DST change", () => {
    const n = buildDatedFaithNotifications([on("final", "22:30")], ctx({ today: "2026-10-30", now: new Date("2026-10-30T12:00:00Z") }));
    const local = n.map((x) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(x.at));
    expect(n.map((x) => x.date)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(new Set(local)).toEqual(new Set(["22:30"]));
  });
});

describe("dated Faith reminders", () => {
  it("are off unless turned on, and schedule one per kind per chosen day for the next seven days", () => {
    expect(buildDatedFaithNotifications([{ ...on("reading", "07:00"), enabled: false }], ctx())).toEqual([]);
    const n = buildDatedFaithNotifications([on("reading", "19:00", [2, 4])], ctx()); // Tue, Thu
    expect(n.map((x) => x.date)).toEqual(["2026-11-03", "2026-11-05"]);
    expect(new Set(n.map((x) => x.id)).size).toBe(n.length);
  });

  it("never sends a reminder for something already done today, or one in the past", () => {
    const list = [on("reading", "19:00"), on("prayer", "19:00"), on("challenge", "19:00"), on("fitness", "19:00"), on("accountability", "20:00"), on("final", "22:30")];
    const todays = (done: FaithReminderContext["done"]) => buildDatedFaithNotifications(list, ctx({ done })).filter((x) => x.date === "2026-11-03").map((x) => x.kind);
    expect(todays(none)).toEqual(["reading", "prayer", "challenge", "fitness", "accountability", "final"]);
    expect(todays({ ...none, reading: true })).toEqual(["prayer", "challenge", "fitness", "accountability", "final"]);
    // Both journey activities done: no reading, prayer, evening check or final reminder today.
    expect(todays({ reading: true, prayer: true, challenge: false, fitness: true })).toEqual(["challenge"]);
    // A time already past today isn't scheduled; tomorrow's still is.
    const late = buildDatedFaithNotifications([on("reading", "05:00")], ctx());
    expect(late[0]!.date).toBe("2026-11-04");
  });

  it("sends the strict journey's before-midnight reminder only while a journey is active; the evening check-in is for everyone", () => {
    const n = buildDatedFaithNotifications([on("accountability", "20:00"), on("final", "22:30"), on("reading", "19:00")], ctx({ journeyActive: false }));
    expect(new Set(n.map((x) => x.kind))).toEqual(new Set(["reading", "accountability"]));
    const j = buildDatedFaithNotifications([on("final", "22:30")], ctx({ journeyActive: true }));
    expect(j.length).toBeGreaterThan(0);
  });

  it("respects quiet hours, including ones that cross midnight", () => {
    const quiet = { start: "22:00", end: "07:00" };
    expect(inQuietHours("22:30", quiet)).toBe(true);
    expect(inQuietHours("06:59", quiet)).toBe(true);
    expect(inQuietHours("07:00", quiet)).toBe(false);
    expect(inQuietHours("13:00", { start: "12:00", end: "14:00" })).toBe(true);
    expect(buildDatedFaithNotifications([on("final", "22:30"), on("reading", "19:00")], ctx({ quiet })).every((x) => x.kind === "reading")).toBe(true);
    expect(buildFaithNotifications([on("devotional", "06:30")], quiet)).toEqual([]);
  });

  it("cancels today's reminders for what's just been done, and the journey reminders only once both are done", () => {
    const cancelReading = todayIdsToCancel({ ...none, reading: true });
    const cancelBoth = todayIdsToCancel({ ...none, reading: true, prayer: true });
    expect(cancelReading).toHaveLength(1);
    expect(cancelBoth).toHaveLength(4); // reading, prayer, evening check, final
    expect(todayIdsToCancel(none)).toEqual([]);
  });

  it("weekly kinds stay weekly and dated kinds are never also scheduled weekly (no duplicates)", () => {
    const list = [on("prayer", "12:00"), on("devotional", "06:30")];
    expect(buildFaithNotifications(list).every((n) => n.title === "Today's devotional")).toBe(true);
    expect(buildDatedFaithNotifications(list, ctx()).every((n) => n.kind === "prayer")).toBe(true);
  });
});
