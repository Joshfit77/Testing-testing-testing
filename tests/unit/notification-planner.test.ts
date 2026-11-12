import { describe, expect, it } from "vitest";
import { ALL_FAITH_REMINDER_IDS, FAITH_REMINDER_KINDS, defaultFaithReminder, type FaithReminder } from "@/lib/faith-reminders";
import { ALL_APP_REMINDER_IDS, APP_REMINDER_KINDS, appReminderFromRow, defaultAppReminder, safeNotificationPath, waterTimes, type AppReminder } from "@/lib/notifications/catalog";
import { DEFAULT_NOTIFICATION_PREFS, NOTHING_DONE, PENDING_BUDGET, planNotifications, todaysReminders, type PlanInput, type PlannerContext } from "@/lib/notifications/planner";

const EVERY = [0, 1, 2, 3, 4, 5, 6] as AppReminder["weekdays"];
const faithOff = () => FAITH_REMINDER_KINDS.map(defaultFaithReminder);
const appOff = () => APP_REMINDER_KINDS.map(defaultAppReminder);
const faithOn = (kind: FaithReminder["kind"], time: string, weekdays = EVERY as FaithReminder["weekdays"]) =>
  faithOff().map((r) => (r.kind === kind ? { ...r, enabled: true, time, weekdays } : r));
const app = (...on: Partial<AppReminder>[]) => appOff().map((r) => ({ ...r, ...(on.find((o) => o.kind === r.kind) ?? {}) }));
// Tuesday 3 November 2026, 06:00 in New York (11:00 UTC).
const ctx = (over: Partial<PlannerContext> = {}): PlannerContext => ({
  today: "2026-11-03",
  timezone: "America/New_York",
  now: new Date("2026-11-03T11:00:00Z"),
  faithEnabled: true,
  journeyActive: false,
  done: { ...NOTHING_DONE },
  training: { hasProgram: false, workoutDates: [] },
  openPrayerRequests: 0,
  ...over,
});
const plan = (over: Partial<PlanInput> = {}) => planNotifications({ faith: faithOff(), app: appOff(), prefs: { ...DEFAULT_NOTIFICATION_PREFS }, ctx: ctx(), ...over });
const local = (d: Date, tz = "America/New_York") => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

describe("preferences: nothing unless the member turns it on", () => {
  it("every reminder starts off, so a new account gets no notifications at all", () => {
    expect(faithOff().every((r) => !r.enabled)).toBe(true);
    expect(appOff().every((r) => !r.enabled)).toBe(true);
    expect(plan()).toEqual([]);
  });
  it("rows read back safely, with defaults for anything missing or invalid", () => {
    expect(appReminderFromRow("water", { enabled: true, remind_at: "08:30:00", weekdays: [1, 1, 9, 2], interval_minutes: 999, end_at: "18:00:00" })).toMatchObject({
      enabled: true,
      time: "08:30",
      weekdays: [1, 2],
      intervalMinutes: 120,
      endTime: "18:00",
    });
    expect(appReminderFromRow("workout", null)).toEqual(defaultAppReminder("workout"));
    expect(appReminderFromRow("lunch", { enabled: "yes", remind_at: "25:00" })).toMatchObject({ enabled: false, time: "12:30" });
  });
  it("pausing all optional reminders schedules nothing, and keeps the choices", () => {
    const input = { faith: faithOn("reading", "19:00"), app: app({ kind: "water", enabled: true }) };
    expect(plan(input).length).toBeGreaterThan(0);
    expect(plan({ ...input, prefs: { ...DEFAULT_NOTIFICATION_PREFS, paused: true } })).toEqual([]);
    expect(input.faith.find((r) => r.kind === "reading")!.enabled).toBe(true);
  });
  it("the profile's Scripture setting only changes the workout message; Faith reminders still go out", () => {
    // "Let the AI coach and workout reminders draw on Scripture. The Faith tab is always available."
    const workout = app({ kind: "workout", enabled: true, time: "17:00", weekdays: EVERY, style: "faith" });
    const off = plan({ faith: faithOn("reading", "19:00"), app: workout, ctx: ctx({ faithEnabled: false }) });
    expect(off.some((x) => x.kind === "reading")).toBe(true);
    expect(off.find((x) => x.kind === "workout")!.title).toBe("Time to train");
    const on = plan({ faith: faithOn("reading", "19:00"), app: workout, ctx: ctx({ faithEnabled: true }) });
    expect(on.find((x) => x.kind === "workout")!.title).toBe("Rooted in faith. Built for strength.");
  });
});

describe("custom times, days and frequency", () => {
  it("a meal reminder at the chosen time on the chosen days", () => {
    const n = plan({ app: app({ kind: "lunch", enabled: true, time: "13:15", weekdays: [2, 4] }) }); // Tue, Thu
    expect(n.map((x) => x.date)).toEqual(["2026-11-03", "2026-11-05"]);
    expect(new Set(n.map((x) => local(x.at!)))).toEqual(new Set(["13:15"]));
  });
  it("water every two hours from 9 AM until 7 PM, at most eight a day, and no duplicate ids", () => {
    const w = { ...defaultAppReminder("water"), enabled: true };
    expect(waterTimes(w)).toEqual(["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"]);
    expect(waterTimes({ ...w, time: "06:00", endTime: "23:00", intervalMinutes: 60 })).toHaveLength(8);
    const n = plan({ app: app({ ...w }), prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 } });
    expect(n.filter((x) => x.date === "2026-11-03")).toHaveLength(6);
    expect(new Set(n.map((x) => x.id)).size).toBe(n.length);
  });
  it("weekly reminders repeat on their day (plan_progress, prayer follow-up, weekly review) and only when relevant", () => {
    const review = plan({ app: app({ kind: "weekly_review", enabled: true, time: "17:00", weekdays: [0] }) });
    expect(review).toHaveLength(1);
    expect(review[0]!.on).toEqual({ weekday: 1, hour: 17, minute: 0 }); // Capacitor: 1 = Sunday
    // Reading-plan progress only with an active plan; prayer follow-up only with open prayer requests.
    expect(plan({ faith: faithOn("plan_progress", "18:00", [0]) })).toEqual([]);
    expect(plan({ faith: faithOn("plan_progress", "18:00", [0]), ctx: ctx({ journeyActive: true }) })).toHaveLength(1);
    expect(plan({ faith: faithOn("prayer_followup", "19:30", [0]) })).toEqual([]);
    expect(plan({ faith: faithOn("prayer_followup", "19:30", [0]), ctx: ctx({ openPrayerRequests: 2 }) })).toHaveLength(1);
  });
});

describe("time zones and daylight saving", () => {
  it("dated reminders keep the same wall-clock time across the end of daylight saving", () => {
    // New York leaves EDT on Sunday 1 November 2026.
    const n = plan({ app: app({ kind: "breakfast", enabled: true, time: "08:00" }), ctx: ctx({ today: "2026-10-30", now: new Date("2026-10-30T10:00:00Z") }) });
    expect(n.map((x) => x.date)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(new Set(n.map((x) => local(x.at!)))).toEqual(new Set(["08:00"]));
    // 8 AM is 12:00 UTC before the change and 13:00 UTC after it.
    expect(n[0]!.at!.toISOString()).toBe("2026-10-30T12:00:00.000Z");
    expect(n[3]!.at!.toISOString()).toBe("2026-11-02T13:00:00.000Z");
  });
  it("and across the start of daylight saving (a skipped time moves an hour later instead of being lost)", () => {
    const n = plan({ app: app({ kind: "snack", enabled: true, time: "02:30" }), ctx: ctx({ today: "2026-03-07", now: new Date("2026-03-07T00:00:00Z") }) });
    expect(n.find((x) => x.date === "2026-03-08")!.at!.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });
  it("times follow the account's time zone, wherever the server runs", () => {
    const n = plan({ app: app({ kind: "dinner", enabled: true, time: "18:30" }), ctx: ctx({ timezone: "Asia/Tokyo", today: "2026-11-03", now: new Date("2026-11-02T20:00:00Z") }) });
    expect(n[0]!.at!.toISOString()).toBe("2026-11-03T09:30:00.000Z");
  });
  it("weekly repeating reminders are converted to the phone's clock when the phone is in another zone", () => {
    const r = { kind: "weekly_review" as const, enabled: true, time: "17:00", weekdays: [0] as AppReminder["weekdays"] };
    expect(plan({ app: app(r), ctx: ctx({ deviceTimezone: "America/New_York" }) })[0]!.on).toEqual({ weekday: 1, hour: 17, minute: 0 });
    // 5 PM Sunday in New York is 10 PM Sunday in London (both on standard time in November).
    expect(plan({ app: app(r), ctx: ctx({ deviceTimezone: "Europe/London" }) })[0]!.on).toEqual({ weekday: 1, hour: 22, minute: 0 });
    // …and 7 AM Monday in Tokyo.
    expect(plan({ app: app(r), ctx: ctx({ deviceTimezone: "Asia/Tokyo" }) })[0]!.on).toEqual({ weekday: 2, hour: 7, minute: 0 });
  });
});

describe("quiet hours", () => {
  const quiet = { start: "21:00", end: "07:00" };
  it("suppress every kind of reminder inside them, including across midnight", () => {
    const n = plan({
      faith: faithOn("reading", "22:00"),
      app: app({ kind: "breakfast", enabled: true, time: "06:30" }, { kind: "winddown", enabled: true, time: "21:30" }, { kind: "dinner", enabled: true, time: "18:30" }),
      prefs: { ...DEFAULT_NOTIFICATION_PREFS, quiet },
    });
    expect(new Set(n.map((x) => x.kind))).toEqual(new Set(["dinner"]));
  });
  it("drop only the water reminders that fall inside them", () => {
    const n = plan({ app: app({ kind: "water", enabled: true, time: "07:00", endTime: "23:00", intervalMinutes: 120 }), prefs: { ...DEFAULT_NOTIFICATION_PREFS, quiet, dailyLimit: 20 } });
    expect(n.filter((x) => x.date === "2026-11-04").map((x) => x.time)).toEqual(["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00"]);
  });
});

describe("completion-aware: nothing for what's already done today", () => {
  const todayKinds = (input: Partial<PlanInput>) => plan(input).filter((x) => x.date === "2026-11-03").map((x) => x.kind);
  it("a finished workout cancels today's workout reminder; tomorrow's stays", () => {
    const a = app({ kind: "workout", enabled: true, time: "17:00", weekdays: EVERY });
    expect(todayKinds({ app: a })).toEqual(["workout"]);
    expect(todayKinds({ app: a, ctx: ctx({ done: { ...NOTHING_DONE, workout: true } }) })).toEqual([]);
    expect(plan({ app: a, ctx: ctx({ done: { ...NOTHING_DONE, workout: true } }) }).some((x) => x.date === "2026-11-04")).toBe(true);
  });
  it("a logged meal stops that meal's reminder only", () => {
    const a = app({ kind: "lunch", enabled: true }, { kind: "dinner", enabled: true });
    expect(todayKinds({ app: a, ctx: ctx({ done: { ...NOTHING_DONE, lunch: true } }) })).toEqual(["dinner"]);
  });
  it("reaching the water goal stops the rest of today's water reminders", () => {
    const a = app({ kind: "water", enabled: true });
    expect(todayKinds({ app: a, ctx: ctx({ done: { ...NOTHING_DONE, water: true } }) })).toEqual([]);
  });
  it("Bible reading and prayer done stop the reading, prayer and evening reminders", () => {
    const faith = faithOff().map((r) => (["reading", "prayer", "accountability"].includes(r.kind) ? { ...r, enabled: true, time: "19:00" } : r));
    expect(new Set(todayKinds({ faith }))).toEqual(new Set(["reading", "prayer", "accountability"]));
    expect(todayKinds({ faith, ctx: ctx({ done: { ...NOTHING_DONE, reading: true } }) }).sort()).toEqual(["accountability", "prayer"]);
    expect(todayKinds({ faith, ctx: ctx({ done: { ...NOTHING_DONE, reading: true, prayer: true } }) })).toEqual([]);
  });
});

describe("recovery days and the training schedule", () => {
  // Program: training Tue 3, Thu 5, Sat 7 November.
  const training = { hasProgram: true, workoutDates: ["2026-11-03", "2026-11-05", "2026-11-07"] };
  const a = app({ kind: "workout", enabled: true, time: "17:00", weekdays: [1] }, { kind: "recovery", enabled: true, time: "09:00" });
  it("with a program: the workout reminder on training days, the recovery reminder instead on rest days", () => {
    const n = plan({ app: a, ctx: ctx({ training }) });
    const byDate = (d: string) => n.filter((x) => x.date === d).map((x) => x.kind);
    expect(byDate("2026-11-03")).toEqual(["workout"]);
    expect(byDate("2026-11-04")).toEqual(["recovery"]);
    expect(byDate("2026-11-05")).toEqual(["workout"]);
    for (const d of new Set(n.map((x) => x.date))) expect(byDate(d!)).toHaveLength(1);
  });
  it("without a program: the chosen workout days, and recovery on the other chosen days", () => {
    const b = app({ kind: "workout", enabled: true, time: "17:00", weekdays: [2, 4] }, { kind: "recovery", enabled: true, time: "09:00", weekdays: EVERY });
    const n = plan({ app: b });
    expect(n.filter((x) => x.kind === "workout").map((x) => x.date)).toEqual(["2026-11-03", "2026-11-05"]);
    expect(n.filter((x) => x.kind === "recovery").map((x) => x.date)).not.toContain("2026-11-03");
  });
  it("the weekly training plan reminder needs an active program", () => {
    const p = app({ kind: "plan_week", enabled: true, weekdays: [0] });
    expect(plan({ app: p })).toEqual([]);
    expect(plan({ app: p, ctx: ctx({ training }) })).toHaveLength(1);
  });
  it("no double nudge: the Faith fitness-goal reminder steps aside on days with a workout or recovery reminder", () => {
    const n = plan({ faith: faithOn("fitness", "18:00"), app: a, ctx: ctx({ training }) });
    expect(n.some((x) => x.kind === "fitness")).toBe(false);
    expect(plan({ faith: faithOn("fitness", "18:00") }).some((x) => x.kind === "fitness")).toBe(true);
  });
});

describe("strict and flexible reading journeys", () => {
  const faith = faithOff().map((r) => (["final", "accountability", "reading"].includes(r.kind) ? { ...r, enabled: true } : r));
  it("the before-midnight reminder exists only for a strict journey; the evening check-in works without one", () => {
    expect(new Set(plan({ faith, ctx: ctx({ journeyActive: true }) }).map((x) => x.kind))).toEqual(new Set(["final", "accountability", "reading"]));
    expect(new Set(plan({ faith, ctx: ctx({ journeyActive: false }) }).map((x) => x.kind))).toEqual(new Set(["accountability", "reading"]));
  });
  it("reading and prayer open the journey while one is active, otherwise the Bible and the prayer journal", () => {
    const f = faithOff().map((r) => (["reading", "prayer"].includes(r.kind) ? { ...r, enabled: true, time: "19:00" } : r));
    const urls = (journeyActive: boolean) => Object.fromEntries(plan({ faith: f, ctx: ctx({ journeyActive }) }).map((x) => [x.kind, x.url]));
    expect(urls(true)).toEqual({ reading: "/faith/journey", prayer: "/faith/journey" });
    expect(urls(false)).toEqual({ reading: "/faith/bible", prayer: "/faith/journal" });
  });
});

describe("frequency limits", () => {
  const busy = () => {
    const faith = faithOff().map((r) => (["reading", "prayer", "accountability", "challenge", "fitness", "devotional", "memorize"].includes(r.kind) ? { ...r, enabled: true, time: "19:00" } : r));
    const a = appOff().map((r) => ({ ...r, enabled: true }));
    return { faith, app: a, ctx: ctx({ journeyActive: true, training: { hasProgram: false, workoutDates: [] } }) };
  };
  it("no day has more reminders than the daily limit, and the most important ones are kept", () => {
    const n = plan({ ...busy(), prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 5 } });
    const byDate = new Map<string, string[]>();
    for (const x of n.filter((x) => x.date)) byDate.set(x.date!, [...(byDate.get(x.date!) ?? []), x.kind]);
    const weeklyOn = (date: string) => n.filter((x) => !x.date && x.on!.weekday === new Date(`${date}T12:00:00Z`).getUTCDay() + 1).length;
    for (const [date, kinds] of byDate) {
      expect(kinds.length + weeklyOn(date), date).toBeLessThanOrEqual(5);
      expect(kinds).not.toContain("water");
    }
    expect(byDate.get("2026-11-04")).toEqual(expect.arrayContaining(["accountability", "reading", "prayer"]));
  });
  it("never more than the phone can hold, keeping the soonest (room left for the sleep alarm and rest timer)", () => {
    const n = plan({ ...busy(), prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 } });
    expect(n.length).toBeLessThanOrEqual(PENDING_BUDGET);
    expect(PENDING_BUDGET).toBeLessThanOrEqual(64 - 9);
    const dated = n.filter((x) => x.at).map((x) => x.at!.getTime());
    expect(dated).toEqual([...dated].sort((a, b) => a - b));
    // Today and tomorrow are covered first.
    expect(n.some((x) => x.date === "2026-11-03") && n.some((x) => x.date === "2026-11-04")).toBe(true);
  });
  it("every id is unique and belongs to the reminder ranges (never the rest timer 4201 or the sleep alarm 5400–5410)", () => {
    const n = plan({ ...busy(), prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 } });
    expect(new Set(n.map((x) => x.id)).size).toBe(n.length);
    const all = new Set([...ALL_FAITH_REMINDER_IDS, ...ALL_APP_REMINDER_IDS]);
    expect(all.size).toBe(ALL_FAITH_REMINDER_IDS.length + ALL_APP_REMINDER_IDS.length);
    for (const x of n) expect(all.has(x.id)).toBe(true);
    for (const id of [4201, ...Array.from({ length: 11 }, (_, i) => 5400 + i)]) expect(all.has(id)).toBe(false);
  });
});

describe("missed reminders and the in-app list", () => {
  it("lists today's reminders as done, missed (time passed) or upcoming", () => {
    const faith = faithOn("reading", "07:00");
    const a = app({ kind: "lunch", enabled: true, time: "12:30" }, { kind: "dinner", enabled: true, time: "18:30" });
    // 1 PM in New York; reading done, lunch's time passed without a lunch logged.
    const items = todaysReminders({ faith, app: a, prefs: { ...DEFAULT_NOTIFICATION_PREFS }, ctx: ctx({ now: new Date("2026-11-03T18:00:00Z"), done: { ...NOTHING_DONE, reading: true } }) });
    expect(Object.fromEntries(items.map((i) => [i.kind, i.status]))).toEqual({ reading: "done", lunch: "missed", dinner: "upcoming" });
  });
  it("water, which repeats through the day, shows its next time while one is still to come", () => {
    const w = app({ kind: "water", enabled: true, time: "09:00", endTime: "19:00", intervalMinutes: 120 });
    const at = (iso: string) => todaysReminders({ faith: faithOff(), app: w, prefs: { ...DEFAULT_NOTIFICATION_PREFS }, ctx: ctx({ now: new Date(iso) }) })[0];
    expect(at("2026-11-03T19:30:00Z")).toMatchObject({ status: "upcoming", time: "15:00" }); // 2:30 PM in New York
    expect(at("2026-11-04T01:00:00Z")).toMatchObject({ status: "missed", time: "09:00" }); // 8 PM: none left
  });
  it("a reminder missed while the phone was off is still listed (it isn't rescheduled into the past)", () => {
    const a = app({ kind: "breakfast", enabled: true, time: "08:00" });
    const later = ctx({ now: new Date("2026-11-03T16:00:00Z") });
    expect(plan({ app: a, ctx: later }).some((x) => x.date === "2026-11-03")).toBe(false);
    expect(todaysReminders({ faith: faithOff(), app: a, prefs: { ...DEFAULT_NOTIFICATION_PREFS }, ctx: later })[0]).toMatchObject({ kind: "breakfast", status: "missed" });
  });
});

describe("deep links", () => {
  it("every reminder opens one of the app's own screens", () => {
    const faith = faithOff().map((r) => ({ ...r, enabled: true }));
    const a = appOff().map((r) => ({ ...r, enabled: true }));
    const n = plan({ faith, app: a, prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 }, ctx: ctx({ journeyActive: true, openPrayerRequests: 1, training: { hasProgram: true, workoutDates: ["2026-11-04"] } }) });
    expect(new Set(n.map((x) => x.kind)).size).toBeGreaterThan(15);
    for (const x of n) expect(safeNotificationPath(x.url), x.kind).toBe(x.url);
  });
  it("anything else is refused", () => {
    for (const bad of ["https://evil.example/", "//evil.example", "/api/account/export", "/faith/../admin", "javascript:alert(1)", "/admin", "", null, 42]) expect(safeNotificationPath(bad)).toBeNull();
    expect(safeNotificationPath("/faith/journey")).toBe("/faith/journey");
  });
});
