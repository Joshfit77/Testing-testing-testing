import { ALARM_ID_BASE, ALL_ALARM_IDS, alarmConfigFromForm, alarmNotifications, DEFAULT_ALARM, describeAlarm, parseAlarmConfig, SNOOZE_NOTIFICATION_ID, upcomingAlarms, windowStart } from "@/lib/domain/sleep-alarm";
import { ALL_FAITH_REMINDER_IDS } from "@/lib/faith-reminders";
import { ALL_REMINDER_IDS } from "@/lib/reminders";

describe("alarm configuration", () => {
  it("falls back to the default for bad input and keeps valid input", () => {
    expect(parseAlarmConfig(null)).toEqual(DEFAULT_ALARM);
    expect(parseAlarmConfig({ ...DEFAULT_ALARM, wakeTime: "25:00" })).toEqual(DEFAULT_ALARM);
    const cfg = { ...DEFAULT_ALARM, enabled: true, wakeTime: "07:15", days: ["sat", "sun"], mode: "smart" as const, windowMinutes: 30 };
    expect(parseAlarmConfig(cfg)).toEqual(cfg);
  });

  it("reads the settings form, keeping what the form doesn't offer from the previous settings", () => {
    const form = new FormData();
    form.set("enabled", "on");
    form.set("wakeTime", "06:45");
    form.append("days", "sun");
    form.append("days", "mon");
    form.append("days", "nope");
    form.set("snoozeMinutes", "10");
    const previous = { ...DEFAULT_ALARM, mode: "smart" as const, windowMinutes: 20 };
    expect(alarmConfigFromForm(form, previous)).toEqual({ enabled: true, wakeTime: "06:45", windowMinutes: 20, mode: "smart", days: ["mon", "sun"], snoozeMinutes: 10 });
    expect(alarmConfigFromForm(new FormData())).toEqual({ enabled: false, wakeTime: "", windowMinutes: 0, mode: "fixed", days: [], snoozeMinutes: 9 });
  });

  it("describes the schedule in words", () => {
    expect(describeAlarm({ ...DEFAULT_ALARM, wakeTime: "06:30" })).toBe("6:30 AM on weekdays");
    expect(describeAlarm({ ...DEFAULT_ALARM, wakeTime: "00:05", days: [...DEFAULT_ALARM.days, "sat", "sun"] })).toBe("12:05 AM every day");
    expect(describeAlarm({ ...DEFAULT_ALARM, wakeTime: "13:00", days: ["sat", "sun"] })).toBe("1:00 PM at the weekend");
    expect(describeAlarm({ ...DEFAULT_ALARM, wakeTime: "12:00", days: ["wed", "mon", "fri"] })).toBe("12:00 PM on Mon, Wed and Fri");
    expect(describeAlarm({ ...DEFAULT_ALARM, days: [] })).toBe("6:30 AM, no days chosen");
  });

  it("maps days to one weekly notification each with ids no other reminder uses", () => {
    const cfg = { ...DEFAULT_ALARM, enabled: true, wakeTime: "06:30", days: ["sun", "mon"] as ("sun" | "mon")[] };
    expect(alarmNotifications(cfg)).toEqual([
      { id: ALARM_ID_BASE + 2, weekday: 2, hour: 6, minute: 30 },
      { id: ALARM_ID_BASE + 1, weekday: 1, hour: 6, minute: 30 },
    ]);
    expect(alarmNotifications({ ...cfg, enabled: false })).toEqual([]);
    expect(ALL_ALARM_IDS).toContain(SNOOZE_NOTIFICATION_ID);
    expect(ALL_ALARM_IDS.filter((id) => ALL_REMINDER_IDS.includes(id) || ALL_FAITH_REMINDER_IDS.includes(id))).toEqual([]);
  });

  it("lists the next alarms on the chosen days in the member's zone, skipping times already past", () => {
    // Thursday 22 Oct 2026, 10:00 in New York (14:00Z).
    const now = new Date("2026-10-22T14:00:00Z");
    const next = upcomingAlarms({ ...DEFAULT_ALARM, enabled: true, wakeTime: "06:30", days: ["thu", "fri", "mon"] }, now, "America/New_York");
    // Thursday's 6:30 is past; Friday 23 Oct 6:30 EDT = 10:30Z; Monday 26 Oct 6:30 EDT = 10:30Z.
    expect(next).toEqual(["2026-10-23T10:30:00.000Z", "2026-10-26T10:30:00.000Z", "2026-10-29T10:30:00.000Z"]);
    expect(upcomingAlarms({ ...DEFAULT_ALARM, enabled: false }, now, "UTC")).toEqual([]);
  });

  it("follows the clock change", () => {
    // Saturday 31 Oct 2026 in New York; on Sunday 1 Nov the clocks go back, so 6:30 EST is 11:30Z.
    const now = new Date("2026-10-31T12:00:00Z");
    expect(upcomingAlarms({ ...DEFAULT_ALARM, enabled: true, days: ["sun"] }, now, "America/New_York", 1)).toEqual(["2026-11-01T11:30:00.000Z"]);
  });

  it("knows the window start", () => {
    expect(windowStart("2026-10-23T10:30:00.000Z", 30)).toBe("2026-10-23T10:00:00.000Z");
    expect(windowStart("2026-10-23T10:30:00.000Z", 0)).toBe("2026-10-23T10:30:00.000Z");
  });
});
