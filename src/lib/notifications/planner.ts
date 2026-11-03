/**
 * The one reminder planner: turns the member's Faith, workout, food and recovery reminder settings plus what's
 * already done today into the exact local notifications a phone should hold. Pure and deterministic (tested in
 * tests/unit/notification-planner.test.ts); src/lib/native-notifications.ts hands the result to the phone.
 *
 * Rules, in order:
 * - Nothing is sent while all optional reminders are paused.
 * - Quiet hours suppress any reminder that would fall inside them (also each water reminder separately).
 * - Completion-aware: nothing for today once that activity is done (Bible reading, prayer, challenge, workout, a
 *   logged meal of that kind, the water goal). Later days can't be known yet and are kept.
 * - On a program rest day the recovery reminder is sent instead of the workout reminder; the Faith "fitness goal"
 *   reminder is dropped on any day that already has a workout or recovery reminder (no double nudges).
 * - A daily limit (default 8) keeps the most important reminders of a busy day and drops the rest.
 * - A phone holds a limited number of pending notifications (iOS: 64 per app), so the soonest ones are kept,
 *   leaving room for the sleep alarm and rest timer. The schedule is rebuilt each time the app opens.
 * - Times are the account's time zone, computed day by day, so they stay at the same wall-clock time across a
 *   daylight-saving change.
 */
import { addDaysIso, buildDatedFaithNotifications, buildFaithNotifications, inQuietHours, instantInZone, type FaithReminder, type FaithReminderKind, type QuietHours } from "@/lib/faith-reminders";
import { parseTime, reminderMessage, toCapacitorWeekday, type JsWeekday } from "@/lib/reminders";
import { APP_ID_BASE, APP_REMINDER_INFO, WATER_ID_BASE, channelFor, waterTimes, type AppReminder, type AppReminderKind, type NotificationGroup, type ReminderKind } from "@/lib/notifications/catalog";

export interface NotificationPrefs {
  /** "Pause all optional reminders": choices are kept, nothing is scheduled. */
  paused: boolean;
  quiet: QuietHours | null;
  /** The most optional reminders on any one day. */
  dailyLimit: number;
}
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { paused: false, quiet: null, dailyLimit: 8 };
export const DAILY_LIMIT_MIN = 1;
export const DAILY_LIMIT_MAX = 20;

/** Activities that, once done today, stop today's reminders for them. */
export type CompletionKey = "reading" | "prayer" | "challenge" | "fitness" | "workout" | "breakfast" | "lunch" | "dinner" | "snack" | "water";
export type DoneToday = Record<CompletionKey, boolean>;
export const NOTHING_DONE: DoneToday = { reading: false, prayer: false, challenge: false, fitness: false, workout: false, breakfast: false, lunch: false, dinner: false, snack: false, water: false };

export interface PlannerContext {
  /** The member's local date and the account's time zone (the same clock a reading journey's midnight uses). */
  today: string;
  timezone: string;
  now: Date;
  /** The phone's own time zone, for the weekly repeating reminders, which a phone fires by its local clock. */
  deviceTimezone?: string;
  /** The profile's "draw on Scripture" setting: it only picks the workout message style (the Faith tab and its
   * reminders are always available). */
  faithEnabled: boolean;
  journeyActive: boolean;
  done: DoneToday;
  /** Program training days in the next week, when a program is active. */
  training: { hasProgram: boolean; workoutDates: string[] };
  openPrayerRequests: number;
}

export interface PlannedNotification {
  id: number;
  kind: ReminderKind;
  group: NotificationGroup;
  channelId: string;
  title: string;
  body: string;
  /** The screen tapping it opens. */
  url: string;
  /** Local "HH:MM". */
  time: string;
  /** Dated reminders: the local date and instant. Weekly repeating ones: null and `on`. */
  date: string | null;
  at?: Date;
  /** Capacitor's `schedule.on` (weekday 1 = Sunday … 7 = Saturday), in the phone's local time. */
  on?: { weekday: number; hour: number; minute: number };
  /** Lower is more important when a day is over the limit. */
  priority: number;
}

export interface PlanInput {
  faith: FaithReminder[];
  app: AppReminder[];
  prefs: NotificationPrefs;
  ctx: PlannerContext;
  /** Days ahead for dated reminders (1–7). */
  days?: number;
  /** Most notifications to hold on the phone (64 on iOS, less the sleep alarm and rest timer). */
  budget?: number;
}

/** iOS keeps the first 64 pending notifications per app; 9 stay free for the sleep alarm (7 + snooze) and rest timer. */
export const PENDING_BUDGET = 55;

const PRIORITY: Record<ReminderKind, number> = {
  final: 1,
  accountability: 2,
  reading: 3,
  prayer: 4,
  workout: 5,
  recovery: 5,
  challenge: 6,
  breakfast: 7,
  lunch: 7,
  dinner: 7,
  winddown: 8,
  devotional: 9,
  practices: 9,
  memorize: 9,
  plan_progress: 10,
  prayer_followup: 10,
  plan_week: 10,
  weekly_review: 10,
  fitness: 11,
  snack: 12,
  water: 13,
};

/** Which of today's activities a reminder is about (all of them must be done to stop it). */
export const COMPLETION_OF: Partial<Record<ReminderKind, CompletionKey[]>> = {
  reading: ["reading"],
  prayer: ["prayer"],
  accountability: ["reading", "prayer"],
  final: ["reading", "prayer"],
  challenge: ["challenge"],
  fitness: ["fitness"],
  workout: ["workout"],
  recovery: ["workout"],
  breakfast: ["breakfast"],
  lunch: ["lunch"],
  dinner: ["dinner"],
  snack: ["snack"],
  water: ["water"],
};
export const isDoneToday = (kind: ReminderKind, done: Partial<DoneToday>) => {
  const keys = COMPLETION_OF[kind];
  return Boolean(keys && keys.every((k) => done[k]));
};

/** Where each Faith reminder opens. Reading and prayer go to the journey while one is active. */
export function faithUrl(kind: FaithReminderKind, journeyActive: boolean): string {
  switch (kind) {
    case "reading":
      return journeyActive ? "/faith/journey" : "/faith/bible";
    case "prayer":
      return journeyActive ? "/faith/journey" : "/faith/journal";
    case "accountability":
    case "final":
    case "plan_progress":
      return journeyActive ? "/faith/journey" : "/faith";
    case "practices":
      return "/faith/practices";
    case "memorize":
      return "/faith/memory";
    case "prayer_followup":
      return "/faith/journal";
    default:
      return "/faith";
  }
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() as JsWeekday;

/** A weekly time in the account's zone, as the phone's local weekday and time (the same when both zones agree). */
function onDevice(weekday: JsWeekday, time: string, ctx: PlannerContext): { weekday: number; hour: number; minute: number } {
  const t = parseTime(time) ?? { hour: 0, minute: 0 };
  const device = ctx.deviceTimezone;
  if (!device || device === ctx.timezone) return { weekday: toCapacitorWeekday(weekday), hour: t.hour, minute: t.minute };
  // The next date with that weekday, its instant in the account's zone, read back on the phone's clock.
  let date = ctx.today;
  while (weekdayOf(date) !== weekday) date = addDaysIso(date, 1);
  const at = instantInZone(date, time, ctx.timezone);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: device, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(p.weekday)) as JsWeekday;
  return { weekday: toCapacitorWeekday(wd), hour: Number(p.hour), minute: Number(p.minute) };
}

/** Every notification the phone should hold right now, soonest first. */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { prefs, ctx } = input;
  if (prefs.paused) return [];
  const horizon = Math.min(7, Math.max(1, input.days ?? 7));
  const budget = Math.max(0, input.budget ?? PENDING_BUDGET);
  const faith = input.faith;
  const app = new Map(input.app.map((r) => [r.kind, r]));
  const quiet = prefs.quiet;

  const weekly: PlannedNotification[] = [];
  const dated: PlannedNotification[] = [];
  const base = (kind: ReminderKind, group: NotificationGroup, title: string, body: string, url: string, time: string) => ({
    kind,
    group,
    channelId: channelFor(group),
    title,
    body,
    url,
    time,
    priority: PRIORITY[kind],
  });

  // Faith: the existing builders (weekly repeating and dated).
  const faithTime = new Map(faith.map((r) => [r.kind, r.time]));
  for (const n of buildFaithNotifications(faith, quiet, { journeyActive: ctx.journeyActive, openPrayerRequests: ctx.openPrayerRequests })) {
    const time = faithTime.get(n.kind)!;
    const wd = (n.on.weekday - 1) as JsWeekday;
    weekly.push({ id: n.id, ...base(n.kind, "faith", n.title, n.body, faithUrl(n.kind, ctx.journeyActive), time), date: null, on: onDevice(wd, time, ctx) });
  }
  const faithDone = { reading: ctx.done.reading, prayer: ctx.done.prayer, challenge: ctx.done.challenge, fitness: ctx.done.fitness };
  for (const n of buildDatedFaithNotifications(faith, { today: ctx.today, timezone: ctx.timezone, now: ctx.now, done: faithDone, journeyActive: ctx.journeyActive, quiet, days: horizon })) {
    dated.push({ id: n.id, ...base(n.kind, "faith", n.title, n.body, faithUrl(n.kind, ctx.journeyActive), faithTime.get(n.kind)!), date: n.date, at: n.at });
  }

  // Weekly repeating app reminders: no per-day logic, so they keep working even if the app isn't opened for weeks.
  for (const kind of ["plan_week", "weekly_review", "winddown"] as const) {
    const r = app.get(kind);
    if (!r?.enabled || !parseTime(r.time) || inQuietHours(r.time, quiet)) continue;
    if (kind === "plan_week" && !ctx.training.hasProgram) continue;
    const info = APP_REMINDER_INFO[kind];
    const days = info.cadence === "weekly" ? r.weekdays.slice(0, 1) : r.weekdays;
    for (const d of days) weekly.push({ id: APP_ID_BASE[kind] + d, ...base(kind, info.group, info.title, info.body, info.url, r.time), date: null, on: onDevice(d, r.time, ctx) });
  }

  // Dated app reminders for the coming days.
  const workout = app.get("workout");
  const recovery = app.get("recovery");
  const trainingDay = (date: string) => (ctx.training.hasProgram ? ctx.training.workoutDates.includes(date) : Boolean(workout?.weekdays.includes(weekdayOf(date))));
  const push = (kind: ReminderKind, id: number, date: string, time: string, i: number, title?: string, body?: string) => {
    if (!parseTime(time) || inQuietHours(time, quiet)) return;
    if (i === 0 && isDoneToday(kind, ctx.done)) return;
    const at = instantInZone(date, time, ctx.timezone);
    if (at.getTime() <= ctx.now.getTime()) return;
    const info = APP_REMINDER_INFO[kind as AppReminderKind];
    dated.push({ id, ...base(kind, info.group, title ?? info.title, body ?? info.body, info.url, time), date, at });
  };
  for (let i = 0; i < horizon; i++) {
    const date = addDaysIso(ctx.today, i);
    const wd = weekdayOf(date);
    if (workout?.enabled && trainingDay(date)) {
      const msg = reminderMessage(workout.style, wd, ctx.faithEnabled);
      push("workout", APP_ID_BASE.workout + i, date, workout.time, i, msg.title, msg.body);
    }
    if (recovery?.enabled) {
      const restDay = ctx.training.hasProgram ? !trainingDay(date) : recovery.weekdays.includes(wd) && !(workout?.enabled && workout.weekdays.includes(wd));
      if (restDay) push("recovery", APP_ID_BASE.recovery + i, date, recovery.time, i);
    }
    for (const meal of ["breakfast", "lunch", "dinner", "snack"] as const) {
      const r = app.get(meal);
      if (r?.enabled && r.weekdays.includes(wd)) push(meal, APP_ID_BASE[meal] + i, date, r.time, i);
    }
    const water = app.get("water");
    if (water?.enabled && water.weekdays.includes(wd)) waterTimes(water).forEach((t, slot) => push("water", WATER_ID_BASE + i * 10 + slot, date, t, i));
  }

  // No double training nudge: the Faith "fitness goal" reminder steps aside on days with a workout or recovery one.
  const trainingDates = new Set(dated.filter((n) => n.kind === "workout" || n.kind === "recovery").map((n) => n.date));
  let kept = dated.filter((n) => !(n.kind === "fitness" && trainingDates.has(n.date)));

  // Daily limit: on each day, that day's dated reminders and the weekly ones falling on its weekday compete
  // together, and the most important are kept. (A weekly one dropped on its weekday is left off until the next sync.)
  const limit = Math.min(DAILY_LIMIT_MAX, Math.max(DAILY_LIMIT_MIN, Math.round(prefs.dailyLimit)));
  const rank = (a: PlannedNotification, b: PlannedNotification) => a.priority - b.priority || a.time.localeCompare(b.time);
  const keptIds = new Set<number>();
  const coveredWeekdays = new Set<number>();
  for (let i = 0; i < horizon; i++) {
    const date = addDaysIso(ctx.today, i);
    const wd = toCapacitorWeekday(weekdayOf(date));
    coveredWeekdays.add(wd);
    const day = [...kept.filter((n) => n.date === date), ...weekly.filter((n) => n.on!.weekday === wd)].sort(rank).slice(0, limit);
    for (const n of day) keptIds.add(n.id);
  }
  // Weekdays beyond a short horizon: the weekly ones alone, up to the limit.
  for (const wd of new Set(weekly.map((n) => n.on!.weekday))) {
    if (coveredWeekdays.has(wd)) continue;
    for (const n of weekly.filter((x) => x.on!.weekday === wd).sort(rank).slice(0, limit)) keptIds.add(n.id);
  }
  kept = kept.filter((n) => keptIds.has(n.id));
  const weeklyKept = weekly.filter((n) => keptIds.has(n.id));

  // The phone's pending limit: weekly ones (they repeat on their own) up to what leaves room for two days of dated
  // ones, then the soonest dated ones.
  kept.sort((a, b) => a.at!.getTime() - b.at!.getTime());
  const weeklyRoom = Math.max(0, budget - Math.min(kept.filter((n) => n.date === ctx.today || n.date === addDaysIso(ctx.today, 1)).length, budget));
  const weeklyFinal = [...weeklyKept].sort((a, b) => a.priority - b.priority).slice(0, weeklyRoom);
  const datedFinal = kept.slice(0, Math.max(0, budget - weeklyFinal.length));

  // One notification per id (a later duplicate would replace an earlier one on the phone).
  const seen = new Set<number>();
  return [...datedFinal, ...weeklyFinal].filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
}

export type TodayStatus = "done" | "missed" | "upcoming";
export interface TodayReminder {
  kind: ReminderKind;
  group: NotificationGroup;
  title: string;
  url: string;
  time: string;
  status: TodayStatus;
}

/**
 * Today's reminders as an in-app list (used when this device can't show notifications, and to show what was missed
 * while the phone was off or offline): each with its time and whether it's done, missed or still to come.
 */
export function todaysReminders(input: Omit<PlanInput, "budget" | "days">): TodayReminder[] {
  const { ctx } = input;
  const startOfDay = new Date(instantInZone(ctx.today, "00:00", ctx.timezone).getTime() - 1);
  const all = planNotifications({ ...input, prefs: { ...input.prefs, dailyLimit: DAILY_LIMIT_MAX }, ctx: { ...ctx, now: startOfDay, done: { ...NOTHING_DONE }, deviceTimezone: ctx.timezone }, days: 1, budget: 500 });
  const todayWd = toCapacitorWeekday(weekdayOf(ctx.today));
  const list = all.filter((n) => n.date === ctx.today || (n.date === null && n.on?.weekday === todayWd));
  // One row per kind. Water, which repeats through the day, shows its next time while one is still to come.
  const rows = new Map<ReminderKind, TodayReminder>();
  for (const n of list.sort((a, b) => a.time.localeCompare(b.time))) {
    const at = instantInZone(ctx.today, n.time, ctx.timezone);
    const status: TodayStatus = isDoneToday(n.kind, ctx.done) ? "done" : at.getTime() <= ctx.now.getTime() ? "missed" : "upcoming";
    const prev = rows.get(n.kind);
    if (prev && !(prev.status === "missed" && status === "upcoming")) continue;
    rows.set(n.kind, { kind: n.kind, group: n.group, title: n.title, url: n.url, time: n.time, status });
  }
  return [...rows.values()].sort((a, b) => a.time.localeCompare(b.time));
}
