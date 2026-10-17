import { Weekday } from "@capacitor/local-notifications";
import {
  ALL_REMINDER_IDS,
  DEFAULT_REMINDER_SETTINGS,
  buildReminderSchedule,
  describeSchedule,
  loadReminderSettings,
  parseTime,
  reminderMessage,
  sanitizeReminderSettings,
  saveReminderSettings,
  toCapacitorWeekday,
  type JsWeekday,
} from "@/lib/reminders";

describe("reminder schedule mapping", () => {
  it("maps JS weekdays (0=Sun) to Capacitor's Weekday enum (1=Sun … 7=Sat)", () => {
    expect(toCapacitorWeekday(0)).toBe(Weekday.Sunday);
    expect(toCapacitorWeekday(1)).toBe(Weekday.Monday);
    expect(toCapacitorWeekday(3)).toBe(Weekday.Wednesday);
    expect(toCapacitorWeekday(6)).toBe(Weekday.Saturday);
    const all: JsWeekday[] = [0, 1, 2, 3, 4, 5, 6];
    for (const d of all) expect(toCapacitorWeekday(d)).toBe(new Date(Date.UTC(2026, 9, 18 + d)).getUTCDay() + 1); // Oct 18 2026 is a Sunday
  });

  it("builds one weekly entry per selected day with stable ids", () => {
    const entries = buildReminderSchedule({ enabled: true, weekdays: [5, 1, 3, 1], time: "06:30", style: "friendly" });
    expect(entries).toEqual([
      { id: 5201, jsWeekday: 1, on: { weekday: 2, hour: 6, minute: 30 } },
      { id: 5203, jsWeekday: 3, on: { weekday: 4, hour: 6, minute: 30 } },
      { id: 5205, jsWeekday: 5, on: { weekday: 6, hour: 6, minute: 30 } },
    ]);
    for (const e of entries) expect(ALL_REMINDER_IDS).toContain(e.id);
  });

  it("handles midnight, late evening and Sunday/Saturday edges", () => {
    expect(buildReminderSchedule({ enabled: true, weekdays: [0, 6], time: "00:00", style: "friendly" }).map((e) => e.on)).toEqual([
      { weekday: 1, hour: 0, minute: 0 },
      { weekday: 7, hour: 0, minute: 0 },
    ]);
    expect(buildReminderSchedule({ enabled: true, weekdays: [2], time: "23:59", style: "friendly" })[0]!.on).toEqual({ weekday: 3, hour: 23, minute: 59 });
  });

  it("schedules nothing when disabled, without days, or with an invalid time", () => {
    expect(buildReminderSchedule({ ...DEFAULT_REMINDER_SETTINGS, enabled: false })).toEqual([]);
    expect(buildReminderSchedule({ enabled: true, weekdays: [], time: "07:00", style: "friendly" })).toEqual([]);
    expect(buildReminderSchedule({ enabled: true, weekdays: [1], time: "25:00", style: "friendly" })).toEqual([]);
  });

  it("uses ids that never collide with the rest-timer notification (4201)", () => {
    expect(new Set(ALL_REMINDER_IDS).size).toBe(7);
    expect(ALL_REMINDER_IDS).not.toContain(4201);
  });

  it("parses times strictly", () => {
    expect(parseTime("7:05")).toEqual({ hour: 7, minute: 5 });
    expect(parseTime("18:45")).toEqual({ hour: 18, minute: 45 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("noon")).toBeNull();
  });
});

describe("reminder messages", () => {
  it("only uses faith-flavoured messages when faith is enabled", () => {
    const faith = reminderMessage("faith", 1, true);
    const fallback = reminderMessage("faith", 1, false);
    expect(faith.body).not.toBe(fallback.body);
    expect(fallback).toEqual(reminderMessage("friendly", 1, false));
  });

  it("has a message for every weekday in both styles", () => {
    for (const d of [0, 1, 2, 3, 4, 5, 6] as JsWeekday[]) {
      expect(reminderMessage("friendly", d, true).body.length).toBeGreaterThan(10);
      expect(reminderMessage("faith", d, true).body.length).toBeGreaterThan(10);
    }
  });

  it("describes a schedule in plain English", () => {
    expect(describeSchedule({ enabled: true, weekdays: [1, 3, 5], time: "06:30", style: "friendly" })).toBe("Mon, Wed and Fri at 6:30 AM");
    expect(describeSchedule({ enabled: true, weekdays: [0], time: "18:05", style: "friendly" })).toBe("Sun at 6:05 PM");
    expect(describeSchedule({ enabled: true, weekdays: [6, 0], time: "00:00", style: "friendly" })).toBe("Sat and Sun at 12:00 AM");
  });
});

describe("reminder settings storage", () => {
  beforeEach(() => localStorage.clear());

  it("sanitizes untrusted stored data", () => {
    expect(sanitizeReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(sanitizeReminderSettings({ enabled: "yes", weekdays: [9, 2, 2, "x", -1], time: "99:99", style: "loud" })).toEqual({
      ...DEFAULT_REMINDER_SETTINGS,
      weekdays: [2],
    });
  });

  it("round-trips through localStorage and survives corrupt JSON", () => {
    const s = { enabled: true, weekdays: [2, 4] as JsWeekday[], time: "17:15", style: "faith" as const };
    expect(saveReminderSettings(s)).toBe(true);
    expect(loadReminderSettings()).toEqual(s);
    localStorage.setItem("ngf.workoutReminders.v1", "{not json");
    expect(loadReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
  });
});
