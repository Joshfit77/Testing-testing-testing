/**
 * Wake-up alarm (Sleep & Recovery, Stage D2). The settings are plain data on the member's profile; the phone app
 * schedules them as repeating local notifications (src/lib/native-alarm.ts) and the web app only stores and shows
 * them. What the app can honestly promise: a notification at the chosen time on the chosen days, delivered by the
 * operating system's scheduler under its own rules (silent mode, Focus, battery limits). A "smart" window, which
 * sounds earlier when you seem to be in light sleep, needs the phone to watch sleep in the background; that is not
 * built, so the window is stored but every alarm sounds at the deadline and the settings page says so.
 */
import { z } from "zod";

export const SLEEP_ALARM_VERSION = 1;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  mon: { short: "Mon", long: "Monday" },
  tue: { short: "Tue", long: "Tuesday" },
  wed: { short: "Wed", long: "Wednesday" },
  thu: { short: "Thu", long: "Thursday" },
  fri: { short: "Fri", long: "Friday" },
  sat: { short: "Sat", long: "Saturday" },
  sun: { short: "Sun", long: "Sunday" },
};
/** Capacitor's weekday numbering: Sunday = 1 … Saturday = 7. */
const CAPACITOR_WEEKDAY: Record<Weekday, number> = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

export const SNOOZE_OPTIONS = [5, 9, 10, 15, 20] as const;

export const alarmConfigSchema = z.object({
  enabled: z.boolean(),
  /** "HH:MM", the latest the alarm will sound. */
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a wake time."),
  /** Minutes before `wakeTime` in which a smart alarm may sound; 0 means a fixed time. Stored for later, not used yet. */
  windowMinutes: z.number().int().min(0).max(60),
  mode: z.enum(["fixed", "smart"]),
  days: z.array(z.enum(WEEKDAYS)).max(7),
  snoozeMinutes: z.number().int().min(1).max(30),
});
export type AlarmConfig = z.infer<typeof alarmConfigSchema>;

export const DEFAULT_ALARM: AlarmConfig = { enabled: false, wakeTime: "06:30", windowMinutes: 0, mode: "fixed", days: ["mon", "tue", "wed", "thu", "fri"], snoozeMinutes: 9 };

export function parseAlarmConfig(value: unknown): AlarmConfig {
  const parsed = alarmConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ALARM;
}

/** The settings form's fields, shared by the server action (validation) and the phone (scheduling after a save). */
export function alarmConfigFromForm(form: FormData, previous: AlarmConfig = DEFAULT_ALARM): unknown {
  const days = form.getAll("days").map(String);
  return {
    enabled: form.get("enabled") === "on",
    wakeTime: String(form.get("wakeTime") ?? ""),
    windowMinutes: previous.windowMinutes,
    mode: previous.mode,
    days: WEEKDAYS.filter((d) => days.includes(d)),
    snoozeMinutes: Number(form.get("snoozeMinutes") ?? previous.snoozeMinutes),
  };
}

/** Stable notification ids: one per weekday, plus one for a snoozed alarm. Distinct from workout (5200+) and faith (5300+) reminders. */
export const ALARM_ID_BASE = 5400;
export const SNOOZE_NOTIFICATION_ID = 5410;
export const ALL_ALARM_IDS: number[] = [...WEEKDAYS.map((d) => ALARM_ID_BASE + CAPACITOR_WEEKDAY[d]), SNOOZE_NOTIFICATION_ID];
export const ALARM_ACTION_TYPE = "SLEEP_ALARM";

export interface AlarmNotification {
  id: number;
  weekday: number;
  hour: number;
  minute: number;
}

/** The weekly repeating notifications an enabled alarm needs; none when it is off or has no days. */
export function alarmNotifications(config: AlarmConfig): AlarmNotification[] {
  if (!config.enabled) return [];
  const [hour, minute] = config.wakeTime.split(":").map(Number) as [number, number];
  return WEEKDAYS.filter((d) => config.days.includes(d)).map((d) => ({ id: ALARM_ID_BASE + CAPACITOR_WEEKDAY[d], weekday: CAPACITOR_WEEKDAY[d], hour, minute }));
}

/** "6:30 AM on weekdays", "7:00 AM every day", "6:30 AM on Sat and Sun". */
export function describeAlarm(config: AlarmConfig): string {
  const [h, m] = config.wakeTime.split(":").map(Number) as [number, number];
  const clock = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const days = WEEKDAYS.filter((d) => config.days.includes(d));
  const key = days.join(",");
  if (days.length === 7) return `${clock} every day`;
  if (key === "mon,tue,wed,thu,fri") return `${clock} on weekdays`;
  if (key === "sat,sun") return `${clock} at the weekend`;
  if (days.length === 0) return `${clock}, no days chosen`;
  const names = days.map((d) => WEEKDAY_LABELS[d].short);
  return `${clock} on ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}`;
}

/** The next few times the alarm is due (ISO instants) from `now` in the member's zone, soonest first. */
export function upcomingAlarms(config: AlarmConfig, now: Date, timeZone: string, count = 3): string[] {
  if (!config.enabled || !config.days.length) return [];
  const [hh, mm] = config.wakeTime.split(":").map(Number) as [number, number];
  const out: string[] = [];
  for (let d = 0; d < 8 && out.length < count; d++) {
    const day = new Date(now.getTime() + d * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(day);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const weekday = get("weekday").toLowerCase().slice(0, 3) as Weekday;
    if (!config.days.includes(weekday)) continue;
    const local = `${get("year")}-${get("month")}-${get("day")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const instant = localToInstant(local, timeZone);
    if (instant === null || instant <= now.getTime()) continue;
    out.push(new Date(instant).toISOString());
  }
  return out;
}

/** The earliest a smart alarm may sound for a deadline: the deadline itself when the window is 0. */
export function windowStart(deadline: string, windowMinutes: number): string {
  return new Date(Date.parse(deadline) - windowMinutes * 60_000).toISOString();
}

function localToInstant(local: string, timeZone: string): number | null {
  const wall = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(wall)) return null;
  const offset = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
    const g = (type: string) => Number(p.find((x) => x.type === type)?.value ?? 0);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - Math.floor(t / 1000) * 1000;
  };
  let t = wall - offset(wall);
  const o2 = offset(t);
  if (wall - o2 !== t) t = wall - o2;
  return t;
}

/** What the app can and can't promise about delivery, shown on the settings page. */
export const ALARM_HONESTY = [
  "The alarm is a notification scheduled with the phone's operating system. Silent mode, Do Not Disturb or Focus, battery saving and force-closing the app can stop it sounding. Test it once before you rely on it, and keep a second alarm for anything important.",
  "A smart alarm, which sounds a little earlier when you seem to be sleeping lightly, needs the phone to watch your sleep in the background. That isn't built, so every alarm sounds at the time you set.",
  "This alarm hasn't been tested on a physical phone yet.",
];
