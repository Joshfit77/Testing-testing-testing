/**
 * Workout reminders — device-local, weekly repeating notifications (Capacitor LocalNotifications).
 *
 * Settings are stored per device in localStorage because notifications are scheduled on the device.
 * Everything here is pure / side-effect free except the small storage helpers, which never throw.
 */

/** JavaScript weekday numbering: 0 = Sunday … 6 = Saturday. */
export type JsWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ReminderStyle = "friendly" | "faith";

export interface ReminderSettings {
  enabled: boolean;
  /** Sorted, unique JS weekdays (0 = Sunday). */
  weekdays: JsWeekday[];
  /** 24-hour "HH:MM". */
  time: string;
  style: ReminderStyle;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, weekdays: [1, 3, 5], time: "07:00", style: "friendly" };

/** Stable notification ids: base + JS weekday. Distinct from the rest-timer id (4201) in lib/native.ts. */
export const REMINDER_ID_BASE = 5200;
export const ALL_REMINDER_IDS: number[] = [0, 1, 2, 3, 4, 5, 6].map((d) => REMINDER_ID_BASE + d);

export const WEEKDAY_LABELS: { day: JsWeekday; short: string; long: string }[] = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
  { day: 6, short: "Sat", long: "Saturday" },
  { day: 0, short: "Sun", long: "Sunday" },
];

export function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Capacitor's Weekday enum numbers days 1 = Sunday … 7 = Saturday
 * (see node_modules/@capacitor/local-notifications/dist/esm/definitions.d.ts), i.e. JS getDay() + 1.
 */
export function toCapacitorWeekday(day: JsWeekday): number {
  return day + 1;
}

export interface ReminderScheduleEntry {
  id: number;
  jsWeekday: JsWeekday;
  /** Shape of Capacitor's `schedule.on`. */
  on: { weekday: number; hour: number; minute: number };
}

/** Weekly schedule entries for the given settings (empty when disabled or invalid). */
export function buildReminderSchedule(settings: ReminderSettings): ReminderScheduleEntry[] {
  if (!settings.enabled) return [];
  const t = parseTime(settings.time);
  if (!t) return [];
  return normalizeWeekdays(settings.weekdays).map((d) => ({
    id: REMINDER_ID_BASE + d,
    jsWeekday: d,
    on: { weekday: toCapacitorWeekday(d), hour: t.hour, minute: t.minute },
  }));
}

const FRIENDLY: Record<JsWeekday, string> = {
  0: "Sunday session? Even 20 minutes counts.",
  1: "New week, new reps. Your workout is ready.",
  2: "Leg day is waiting… or whatever today's plan says. Let's go.",
  3: "Midweek check-in: your future self says thanks for training today.",
  4: "The bar won't lift itself. Time to train.",
  5: "Finish the week strong: one more session.",
  6: "Weekend warrior mode: your workout is waiting.",
};

const FAITH: Record<JsWeekday, string> = {
  0: "Strength renewed. A gentle session or walk honours the gift.",
  1: "The narrow way is a daily choice. Your workout is waiting.",
  2: "“Whatsoever ye do, do it heartily” (Colossians 3:23, KJV). Time to train.",
  3: "“Let us not be weary in well doing” (Galatians 6:9, KJV). Show up today.",
  4: "Faithful in little things: today's session counts.",
  5: "“Run with patience the race that is set before us” (Hebrews 12:1, KJV). Time to train.",
  6: "Steward the strength you've been given. Your workout is ready.",
};

export function reminderMessage(style: ReminderStyle, day: JsWeekday, faithEnabled: boolean): { title: string; body: string } {
  const useFaith = style === "faith" && faithEnabled;
  return { title: useFaith ? "Rooted in faith. Built for strength." : "Time to train", body: (useFaith ? FAITH : FRIENDLY)[day] };
}

function normalizeWeekdays(days: readonly number[]): JsWeekday[] {
  return Array.from(new Set(days.filter((d): d is JsWeekday => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
}

/** Validate untrusted (stored) data, falling back to defaults field by field. */
export function sanitizeReminderSettings(raw: unknown): ReminderSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const time = typeof r.time === "string" && parseTime(r.time) ? r.time : DEFAULT_REMINDER_SETTINGS.time;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
    weekdays: Array.isArray(r.weekdays) ? normalizeWeekdays(r.weekdays.filter((d): d is number => typeof d === "number")) : DEFAULT_REMINDER_SETTINGS.weekdays,
    time,
    style: r.style === "faith" || r.style === "friendly" ? r.style : DEFAULT_REMINDER_SETTINGS.style,
  };
}

/** "Mon, Wed and Fri at 7:00 AM" */
export function describeSchedule(settings: ReminderSettings): string {
  const t = parseTime(settings.time);
  const days = WEEKDAY_LABELS.filter((w) => settings.weekdays.includes(w.day)).map((w) => w.short);
  const list = days.length <= 1 ? days.join("") : `${days.slice(0, -1).join(", ")} and ${days.at(-1)}`;
  if (!t) return list;
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${list} at ${h12}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"}`;
}

const STORAGE_KEY = "ngf.workoutReminders.v1";

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeReminderSettings(JSON.parse(raw)) : { ...DEFAULT_REMINDER_SETTINGS };
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export function saveReminderSettings(settings: ReminderSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeReminderSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
