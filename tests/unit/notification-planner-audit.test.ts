import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_FAITH_REMINDER_IDS, FAITH_REMINDER_KINDS, defaultFaithReminder, type FaithReminder } from "@/lib/faith-reminders";
import { ALL_APP_REMINDER_IDS, APP_REMINDER_INFO, APP_REMINDER_KINDS, defaultAppReminder, type AppReminder } from "@/lib/notifications/catalog";
import { DEFAULT_NOTIFICATION_PREFS, NOTHING_DONE, PENDING_BUDGET, faithUrl, planNotifications, type PlanInput, type PlannerContext } from "@/lib/notifications/planner";

/*
 * Notification planner, audit 2026-11-14 (on top of tests/unit/notification-planner.test.ts): a journey that keeps its
 * own time zone, switching a category off, re-planning after a time-zone change, and every deep link checked against
 * the routes that really exist under src/app.
 */

const EVERY = [0, 1, 2, 3, 4, 5, 6] as AppReminder["weekdays"];
const faithOff = () => FAITH_REMINDER_KINDS.map(defaultFaithReminder);
const appOff = () => APP_REMINDER_KINDS.map(defaultAppReminder);
const faithOn = (kinds: FaithReminder["kind"][], time?: string) => faithOff().map((r) => (kinds.includes(r.kind) ? { ...r, enabled: true, time: time ?? r.time, weekdays: EVERY as FaithReminder["weekdays"] } : r));
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

describe("a journey that keeps its own time zone (migration 061)", () => {
  // The member started the journey in Los Angeles and later set their profile to New York. It is 00:30 on 4 November
  // in New York, and still 21:30 on 3 November in Los Angeles: the journey's day (3 Nov) has 2½ hours left.
  const travelled = ctx({
    today: "2026-11-04",
    timezone: "America/New_York",
    now: new Date("2026-11-04T05:30:00Z"),
    journeyActive: true,
    journey: { timezone: "America/Los_Angeles", today: "2026-11-03" },
  });

  it("still plans tonight's before-midnight and reading reminders for the journey's own day", () => {
    const n = plan({ faith: faithOn(["final", "reading"], "22:00"), ctx: travelled });
    const tonight = n.filter((x) => x.date === "2026-11-03");
    expect(tonight.map((x) => x.kind).sort()).toEqual(["final", "reading"]);
    // 22:00 in Los Angeles on 3 November is 06:00 UTC on the 4th: half an hour from now.
    for (const x of tonight) expect(x.at!.toISOString()).toBe("2026-11-04T06:00:00.000Z");
  });

  it("the daily limit still applies to that day", () => {
    const n = plan({ faith: faithOn(["final", "accountability", "reading", "prayer", "challenge"], "22:00"), prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 2 }, ctx: travelled });
    const tonight = n.filter((x) => x.date === "2026-11-03").map((x) => x.kind);
    expect(tonight.sort()).toEqual(["accountability", "final"]);
  });

  it("nothing for the journey's day once reading and prayer are done there", () => {
    const n = plan({ faith: faithOn(["final", "reading"], "22:00"), ctx: { ...travelled, done: { ...NOTHING_DONE, reading: true, prayer: true } } });
    expect(n.filter((x) => x.date === "2026-11-03")).toEqual([]);
    expect(n.some((x) => x.date === "2026-11-04" && x.kind === "final")).toBe(true);
  });
});

describe("switching a category off", () => {
  const everythingOn = () => ({ faith: faithOff().map((r) => ({ ...r, enabled: true })), app: appOff().map((r) => ({ ...r, enabled: true })) });
  const busy = ctx({ journeyActive: true, openPrayerRequests: 2, training: { hasProgram: true, workoutDates: ["2026-11-04", "2026-11-06"] } });
  const big = { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 };

  it.each([...FAITH_REMINDER_KINDS, ...APP_REMINDER_KINDS])("%s off: nothing of that kind is planned, whatever else is on", (kind) => {
    const all = everythingOn();
    const input = {
      faith: all.faith.map((r) => (r.kind === kind ? { ...r, enabled: false } : r)),
      app: all.app.map((r) => (r.kind === kind ? { ...r, enabled: false } : r)),
    };
    expect(plan({ ...input, prefs: big, ctx: busy, budget: 500 }).filter((x) => x.kind === kind)).toEqual([]);
  });

  it("a whole group off removes that group only: every other reminder that was planned is still planned", () => {
    const all = everythingOn();
    const withFaith = plan({ ...all, prefs: big, ctx: busy, budget: 500 });
    const withoutFaith = plan({ faith: faithOff(), app: all.app, prefs: big, ctx: busy, budget: 500 });
    expect(withFaith.some((x) => x.group === "faith")).toBe(true);
    expect(withoutFaith.some((x) => x.group === "faith")).toBe(false);
    // With Faith off there is more room under the daily limit, so the others can only stay or come back.
    const key = (x: (typeof withFaith)[number]) => `${x.id}@${x.at?.toISOString() ?? JSON.stringify(x.on)}`;
    const after = new Set(withoutFaith.map(key));
    for (const x of withFaith.filter((n) => n.group !== "faith")) expect(after.has(key(x)), `${x.kind} ${key(x)}`).toBe(true);
  });

  it("the phone cancels every id the planner can produce before scheduling the new plan (so a switched-off reminder can't linger)", () => {
    const all = everythingOn();
    const cancellable = new Set([...ALL_FAITH_REMINDER_IDS, ...ALL_APP_REMINDER_IDS]);
    for (const tz of ["America/New_York", "Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
      for (const n of plan({ ...all, prefs: big, ctx: { ...busy, timezone: tz, deviceTimezone: "Asia/Tokyo" }, budget: 500 })) expect(cancellable.has(n.id), `${n.kind} ${n.id}`).toBe(true);
    }
  });
});

describe("re-planning (app resume, a time-zone change)", () => {
  const input = { faith: faithOn(["reading", "prayer", "devotional"], "19:00"), app: appOff().map((r) => (r.kind === "water" || r.kind === "dinner" ? { ...r, enabled: true } : r)) };

  it("the same moment planned twice gives the same notifications, one per id", () => {
    const a = plan(input);
    const b = plan(input);
    expect(b).toEqual(a);
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
  });

  it("after the account's time zone changes, each reminder is planned once, at the new zone's wall-clock time", () => {
    const tokyo = plan({ ...input, ctx: ctx({ timezone: "Asia/Tokyo", today: "2026-11-03", now: new Date("2026-11-03T00:00:00Z") }) });
    expect(new Set(tokyo.map((x) => x.id)).size).toBe(tokyo.length);
    const reading = tokyo.filter((x) => x.kind === "reading");
    expect(reading).toHaveLength(7);
    // 19:00 in Tokyo is 10:00 UTC, with no daylight saving.
    for (const r of reading) expect(r.at!.toISOString().slice(11, 16)).toBe("10:00");
    // One reading reminder per calendar day: none doubled, none skipped.
    expect(new Set(reading.map((r) => r.date)).size).toBe(7);
  });

  it("stays inside the phone's budget however much is switched on", () => {
    const all = { faith: faithOff().map((r) => ({ ...r, enabled: true })), app: appOff().map((r) => ({ ...r, enabled: true, weekdays: EVERY })) };
    const n = plan({ ...all, prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 }, ctx: ctx({ journeyActive: true, openPrayerRequests: 3 }) });
    expect(n.length).toBeLessThanOrEqual(PENDING_BUDGET);
    expect(PENDING_BUDGET + 9).toBeLessThanOrEqual(64);
  });
});

describe("deep links open screens that exist", () => {
  const APP_DIR = path.join(process.cwd(), "src", "app");

  /** Does `/a/b` resolve to a page under src/app (route groups such as `(app)` are transparent)? */
  function routeExists(url: string): boolean {
    const segments = url.split("/").filter(Boolean);
    const walk = (dir: string, rest: string[]): boolean => {
      if (!rest.length) {
        if (existsSync(path.join(dir, "page.tsx"))) return true;
      }
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (/^\(.+\)$/.test(e.name)) {
          if (walk(path.join(dir, e.name), rest)) return true;
        } else if (rest.length && e.name === rest[0]) {
          if (walk(path.join(dir, e.name), rest.slice(1))) return true;
        }
      }
      return false;
    };
    return walk(APP_DIR, segments);
  }

  it("the checker itself tells a real screen from a missing one", () => {
    expect(routeExists("/faith/journey")).toBe(true);
    expect(routeExists("/faith/no-such-screen")).toBe(false);
  });

  it("every Faith reminder, with and without a journey", () => {
    for (const kind of FAITH_REMINDER_KINDS) for (const journeyActive of [true, false]) expect(routeExists(faithUrl(kind, journeyActive)), `${kind}: ${faithUrl(kind, journeyActive)}`).toBe(true);
  });

  it("every workout, food, water and recovery reminder", () => {
    for (const kind of APP_REMINDER_KINDS) expect(routeExists(APP_REMINDER_INFO[kind].url), `${kind}: ${APP_REMINDER_INFO[kind].url}`).toBe(true);
  });

  it("and every notification a full plan produces", () => {
    const n = plan({
      faith: faithOff().map((r) => ({ ...r, enabled: true })),
      app: appOff().map((r) => ({ ...r, enabled: true })),
      prefs: { ...DEFAULT_NOTIFICATION_PREFS, dailyLimit: 20 },
      ctx: ctx({ journeyActive: true, openPrayerRequests: 1, training: { hasProgram: true, workoutDates: ["2026-11-04"] } }),
      budget: 500,
    });
    expect(n.length).toBeGreaterThan(50);
    for (const x of n) expect(routeExists(x.url), `${x.kind}: ${x.url}`).toBe(true);
  });
});
