/**
 * Workout, food and recovery reminders (Profile → Notifications), alongside the Faith reminders in
 * src/lib/faith-reminders.ts. Every reminder is off until the member turns it on, saved to the account
 * (table notification_reminders) and delivered as a local notification by the iPhone / Android app.
 *
 * Wording rules (tests/unit/notification-copy.test.ts): the text on a lock screen never contains anything the member
 * wrote (prayers, journal, notes), no health details or numbers (weight, calories, sleep, water amounts), no guilt
 * about food or missed days, and nothing that ties a missed reminder to anyone's standing before God. Pure module.
 */
import { parseTime, type JsWeekday } from "@/lib/reminders";
import type { FaithReminderKind } from "@/lib/faith-reminders";

export const APP_REMINDER_KINDS = ["workout", "plan_week", "weekly_review", "breakfast", "lunch", "dinner", "snack", "water", "recovery", "winddown"] as const;
export type AppReminderKind = (typeof APP_REMINDER_KINDS)[number];
export type ReminderKind = FaithReminderKind | AppReminderKind;

export type NotificationGroup = "faith" | "workouts" | "nutrition" | "recovery";
export type WorkoutMessageStyle = "friendly" | "faith";

/** How a reminder repeats: on chosen days, once a week, or every few hours across part of the day (water). */
export type Cadence = "daily" | "weekly" | "interval";

export interface AppReminder {
  kind: AppReminderKind;
  enabled: boolean;
  /** 24-hour "HH:MM". For water, the first reminder of the day. */
  time: string;
  /** Sorted, unique JS weekdays (0 = Sunday). One day for weekly reminders. */
  weekdays: JsWeekday[];
  /** Water only: minutes between reminders (60–240). */
  intervalMinutes: number | null;
  /** Water only: no reminder after this time ("HH:MM"). */
  endTime: string | null;
  /** Workout only: the message style (Faith-inspired only when Faith is on). */
  style: WorkoutMessageStyle;
}

interface Info {
  group: NotificationGroup;
  cadence: Cadence;
  label: string;
  description: string;
  defaultTime: string;
  defaultWeekdays: JsWeekday[];
  title: string;
  body: string;
  /** Where tapping the notification opens. */
  url: string;
}

const EVERY_DAY: JsWeekday[] = [0, 1, 2, 3, 4, 5, 6];

export const APP_REMINDER_INFO: Record<AppReminderKind, Info> = {
  workout: {
    group: "workouts",
    cadence: "daily",
    label: "Scheduled workouts",
    description: "On your program's training days (or the days you choose if you don't have a program). Not sent once today's workout is done.",
    defaultTime: "07:00",
    defaultWeekdays: [1, 3, 5],
    title: "Time to train",
    body: "Your workout is ready in Train.",
    url: "/train",
  },
  plan_week: {
    group: "workouts",
    cadence: "weekly",
    label: "This week's training plan",
    description: "Once a week, a look at the sessions coming up. Only while a program is active.",
    defaultTime: "18:00",
    defaultWeekdays: [0],
    title: "This week's training",
    body: "Your training plan for the week is ready in Train.",
    url: "/train",
  },
  weekly_review: {
    group: "workouts",
    cadence: "weekly",
    label: "Weekly progress review",
    description: "Once a week, a few minutes to look back on your week.",
    defaultTime: "17:00",
    defaultWeekdays: [0],
    title: "Your week in review",
    body: "A few minutes to look back on your week in My Progress.",
    url: "/progress",
  },
  breakfast: {
    group: "nutrition",
    cadence: "daily",
    label: "Breakfast",
    description: "A reminder to log breakfast. Not sent once a breakfast is logged that day.",
    defaultTime: "08:00",
    defaultWeekdays: EVERY_DAY,
    title: "Breakfast",
    body: "When you've eaten, you can log breakfast in Food.",
    url: "/nutrition",
  },
  lunch: {
    group: "nutrition",
    cadence: "daily",
    label: "Lunch",
    description: "A reminder to log lunch. Not sent once a lunch is logged that day.",
    defaultTime: "12:30",
    defaultWeekdays: EVERY_DAY,
    title: "Lunch",
    body: "When you've eaten, you can log lunch in Food.",
    url: "/nutrition",
  },
  dinner: {
    group: "nutrition",
    cadence: "daily",
    label: "Dinner",
    description: "A reminder to log dinner. Not sent once a dinner is logged that day.",
    defaultTime: "18:30",
    defaultWeekdays: EVERY_DAY,
    title: "Dinner",
    body: "When you've eaten, you can log dinner in Food.",
    url: "/nutrition",
  },
  snack: {
    group: "nutrition",
    cadence: "daily",
    label: "Snacks",
    description: "One reminder for snacks, if you like to log them. Not sent once a snack is logged that day.",
    defaultTime: "15:30",
    defaultWeekdays: EVERY_DAY,
    title: "Snacks",
    body: "Had a snack? You can log it in Food whenever you like.",
    url: "/nutrition",
  },
  water: {
    group: "nutrition",
    cadence: "interval",
    label: "Water",
    description: "Every few hours during the day. Stops for the day once your water goal is reached.",
    defaultTime: "09:00",
    defaultWeekdays: EVERY_DAY,
    title: "Water",
    body: "A good moment for a glass of water. Tap to log it.",
    url: "/nutrition",
  },
  recovery: {
    group: "recovery",
    cadence: "daily",
    label: "Recovery days",
    description: "On your program's rest days, instead of the workout reminder. Without a program: the days you choose that aren't workout days.",
    defaultTime: "09:00",
    defaultWeekdays: EVERY_DAY,
    title: "Rest day",
    body: "Recovery is part of training. A short walk or some light mobility can help.",
    url: "/train/recovery",
  },
  winddown: {
    group: "recovery",
    cadence: "daily",
    label: "Wind down for sleep",
    description: "An evening nudge to start your sleep routine.",
    defaultTime: "21:30",
    defaultWeekdays: EVERY_DAY,
    title: "Time to wind down",
    body: "Start winding down for a restful night.",
    url: "/progress/sleep",
  },
};

export const WATER_INTERVALS = [60, 90, 120, 180, 240] as const;
export const DEFAULT_WATER_END = "19:00";
export const MAX_WATER_PER_DAY = 8;

export function defaultAppReminder(kind: AppReminderKind): AppReminder {
  const info = APP_REMINDER_INFO[kind];
  return {
    kind,
    enabled: false,
    time: info.defaultTime,
    weekdays: [...info.defaultWeekdays],
    intervalMinutes: kind === "water" ? 120 : null,
    endTime: kind === "water" ? DEFAULT_WATER_END : null,
    style: "friendly",
  };
}

const normalizeDays = (days: readonly unknown[]): JsWeekday[] =>
  Array.from(new Set(days.map(Number).filter((d): d is JsWeekday => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);

/** DB row → settings, with defaults for anything missing or invalid. */
export function appReminderFromRow(
  kind: AppReminderKind,
  row: { enabled?: unknown; remind_at?: unknown; weekdays?: unknown; interval_minutes?: unknown; end_at?: unknown; style?: unknown } | null | undefined,
): AppReminder {
  const base = defaultAppReminder(kind);
  if (!row) return base;
  const hhmm = (v: unknown, fallback: string | null) => (typeof v === "string" && parseTime(v.slice(0, 5)) ? v.slice(0, 5) : fallback);
  const interval = Number(row.interval_minutes);
  return {
    kind,
    enabled: row.enabled === true,
    time: hhmm(row.remind_at, base.time) ?? base.time,
    weekdays: Array.isArray(row.weekdays) ? normalizeDays(row.weekdays) : base.weekdays,
    intervalMinutes: kind === "water" ? ((WATER_INTERVALS as readonly number[]).includes(interval) ? interval : 120) : null,
    endTime: kind === "water" ? hhmm(row.end_at, DEFAULT_WATER_END) : null,
    style: row.style === "faith" ? "faith" : "friendly",
  };
}

/** The local times of the water reminders in a day: from the start time every interval, up to the end, at most 8. */
export function waterTimes(r: Pick<AppReminder, "time" | "intervalMinutes" | "endTime">): string[] {
  const start = parseTime(r.time);
  const end = parseTime(r.endTime ?? DEFAULT_WATER_END);
  const step = r.intervalMinutes ?? 120;
  if (!start || !end || step < 30) return [];
  const a = start.hour * 60 + start.minute;
  const b = end.hour * 60 + end.minute;
  const out: string[] = [];
  for (let m = a; m <= b && out.length < MAX_WATER_PER_DAY; m += step) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
}

// ------------------------------------------------------------------------------------------------ Android channels

/**
 * Android notification channels, one per group, so members can tune each group in the phone's own settings.
 * Visibility 0 (private): on a secure lock screen Android shows only that there is a notification, not its text.
 */
export const NOTIFICATION_CHANNELS: { id: string; group: NotificationGroup; name: string; description: string }[] = [
  { id: "ngf-faith", group: "faith", name: "Faith reminders", description: "Bible reading, prayer and the other Faith reminders you turned on." },
  { id: "ngf-workouts", group: "workouts", name: "Workout reminders", description: "Scheduled workouts, your weekly plan and progress review." },
  { id: "ngf-nutrition", group: "nutrition", name: "Food and water reminders", description: "Meal logging and water reminders." },
  { id: "ngf-recovery", group: "recovery", name: "Recovery and sleep reminders", description: "Rest days and your wind-down routine." },
];
export const channelFor = (group: NotificationGroup) => NOTIFICATION_CHANNELS.find((c) => c.group === group)!.id;

// ------------------------------------------------------------------------------------------------ Deep links

const SAFE_PREFIXES = ["/faith", "/train", "/nutrition", "/progress", "/home", "/profile/notifications"];

/** A notification may only open one of the app's own screens: a plain path under a known section. */
export function safeNotificationPath(value: unknown): string | null {
  if (typeof value !== "string" || !/^\/[a-z0-9/_-]*$/.test(value) || value.startsWith("//")) return null;
  return SAFE_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`)) ? value : null;
}

// ------------------------------------------------------------------------------------------------ Notification ids

/**
 * Ids already used on the device: rest timer 4201, old device-only workout reminders 5200–5206, weekly Faith
 * 5300–5326, sleep alarm 5400–5410, dated Faith 5500–5566 and the new weekly Faith 5570–5586. These: dated
 * reminders base + days from today (0–6); weekly ones base + weekday; water 5700 + day × 10 + slot.
 */
export const APP_ID_BASE: Record<Exclude<AppReminderKind, "water">, number> = {
  workout: 5600,
  recovery: 5610,
  breakfast: 5620,
  lunch: 5630,
  dinner: 5640,
  snack: 5650,
  plan_week: 5660,
  weekly_review: 5670,
  winddown: 5680,
};
export const WATER_ID_BASE = 5700;
export const LEGACY_WORKOUT_IDS = [5200, 5201, 5202, 5203, 5204, 5205, 5206];
export const ALL_APP_REMINDER_IDS: number[] = [
  ...Object.values(APP_ID_BASE).flatMap((b) => [0, 1, 2, 3, 4, 5, 6].map((d) => b + d)),
  ...Array.from({ length: 70 }, (_, i) => WATER_ID_BASE + i),
  ...LEGACY_WORKOUT_IDS,
];
