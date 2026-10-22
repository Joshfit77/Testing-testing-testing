import { ALL_FAITH_REMINDER_IDS, buildFaithNotifications, defaultFaithReminder, describeFaithReminder, faithReminderFromRow, FAITH_REMINDER_INFO } from "@/lib/faith-reminders";
import { REMINDER_ID_BASE } from "@/lib/reminders";

describe("faith reminders", () => {
  it("are off by default (no row = off)", () => {
    for (const k of ["devotional", "prayer", "practices"] as const) {
      expect(defaultFaithReminder(k).enabled).toBe(false);
      expect(faithReminderFromRow(k, null).enabled).toBe(false);
    }
    expect(buildFaithNotifications([defaultFaithReminder("prayer")])).toEqual([]);
  });

  it("reads database rows (time with seconds, weekdays) safely", () => {
    expect(faithReminderFromRow("prayer", { enabled: true, remind_at: "12:15:00", weekdays: [5, 1, 1, 9] })).toEqual({ kind: "prayer", enabled: true, time: "12:15", weekdays: [1, 5] });
  });

  it("schedules one weekly notification per chosen day with Capacitor weekday numbers", () => {
    const n = buildFaithNotifications([{ kind: "devotional", enabled: true, time: "06:30", weekdays: [0, 3] }]);
    expect(n.map((x) => x.on)).toEqual([
      { weekday: 1, hour: 6, minute: 30 },
      { weekday: 4, hour: 6, minute: 30 },
    ]);
    expect(n[0]!.title).toBe("Today's devotional");
  });

  it("uses ids that don't clash with workout reminders or each other", () => {
    expect(new Set(ALL_FAITH_REMINDER_IDS).size).toBe(21);
    for (let d = 0; d < 7; d++) expect(ALL_FAITH_REMINDER_IDS).not.toContain(REMINDER_ID_BASE + d);
  });

  it("describes the schedule and names the translation of any verse it quotes", () => {
    expect(describeFaithReminder({ time: "20:00", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe("Every day at 8:00 PM");
    expect(describeFaithReminder({ time: "07:05", weekdays: [1, 3] })).toBe("Mon and Wed at 7:05 AM");
    expect(FAITH_REMINDER_INFO.prayer.body).toMatch(/1 Thessalonians 5:17 \(BSB\)/);
    for (const i of Object.values(FAITH_REMINDER_INFO)) expect(i.body).not.toMatch(/streak|missed/i);
  });
});
