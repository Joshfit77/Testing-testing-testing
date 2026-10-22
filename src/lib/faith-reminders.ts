/**
 * Faith reminders (SPEC §12): optional devotional, prayer and daily-practice reminders, off by default.
 *
 * Settings are saved to the account (table faith_reminders) so they follow the user to any device. They
 * are delivered as local notifications by the iPhone / Android app (Capacitor LocalNotifications); a web
 * browser can't deliver them while the site is closed, and the UI says so. Pure helpers only.
 */
import { WEEKDAY_LABELS, parseTime, toCapacitorWeekday, type JsWeekday } from "@/lib/reminders";
import { ACTIVE_TRANSLATION, scriptureText } from "@/data/scripture";

export const FAITH_REMINDER_KINDS = ["devotional", "prayer", "practices"] as const;
export type FaithReminderKind = (typeof FAITH_REMINDER_KINDS)[number];

export interface FaithReminder {
  kind: FaithReminderKind;
  enabled: boolean;
  /** 24-hour "HH:MM". */
  time: string;
  /** Sorted, unique JS weekdays (0 = Sunday). */
  weekdays: JsWeekday[];
}

export const FAITH_REMINDER_INFO: Record<FaithReminderKind, { label: string; description: string; defaultTime: string; title: string; body: string }> = {
  devotional: {
    label: "Devotional",
    description: "A nudge to read today's devotional.",
    defaultTime: "06:30",
    title: "Today's devotional",
    body: "A few quiet minutes with today's reading are waiting for you on the Faith tab.",
  },
  prayer: {
    label: "Prayer",
    description: "A moment to stop and pray.",
    defaultTime: "12:00",
    title: "A moment for prayer",
    body: `“${scriptureText("1 Thessalonians 5:17", "Pray without ceasing.")}” 1 Thessalonians 5:17 (${ACTIVE_TRANSLATION.code})`,
  },
  practices: {
    label: "Daily practices",
    description: "A gentle reminder of the practices you chose.",
    defaultTime: "20:00",
    title: "Your daily practices",
    body: "Whenever you're ready, your practices for today are on the Faith tab. No pressure.",
  },
};

const ALL_DAYS: JsWeekday[] = [0, 1, 2, 3, 4, 5, 6];

export function defaultFaithReminder(kind: FaithReminderKind): FaithReminder {
  return { kind, enabled: false, time: FAITH_REMINDER_INFO[kind].defaultTime, weekdays: [...ALL_DAYS] };
}

/** Notification id bases (rest timer 4201, workout reminders 5200–5206). */
const ID_BASE: Record<FaithReminderKind, number> = { devotional: 5300, prayer: 5310, practices: 5320 };
export const ALL_FAITH_REMINDER_IDS: number[] = FAITH_REMINDER_KINDS.flatMap((k) => ALL_DAYS.map((d) => ID_BASE[k] + d));

export function normalizeWeekdays(days: readonly unknown[]): JsWeekday[] {
  return Array.from(new Set(days.map(Number).filter((d): d is JsWeekday => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
}

/** DB row ("HH:MM:SS" time) → settings, with defaults for anything missing or invalid. */
export function faithReminderFromRow(kind: FaithReminderKind, row: { enabled?: unknown; remind_at?: unknown; weekdays?: unknown } | null | undefined): FaithReminder {
  const base = defaultFaithReminder(kind);
  if (!row) return base;
  const time = typeof row.remind_at === "string" ? row.remind_at.slice(0, 5) : base.time;
  return {
    kind,
    enabled: row.enabled === true,
    time: parseTime(time) ? time : base.time,
    weekdays: Array.isArray(row.weekdays) ? normalizeWeekdays(row.weekdays) : base.weekdays,
  };
}

export interface FaithNotification {
  id: number;
  title: string;
  body: string;
  /** Shape of Capacitor's `schedule.on` (weekday 1 = Sunday … 7 = Saturday). */
  on: { weekday: number; hour: number; minute: number };
}

/** Weekly local notifications for every enabled reminder (empty when all are off). */
export function buildFaithNotifications(reminders: FaithReminder[]): FaithNotification[] {
  const out: FaithNotification[] = [];
  for (const r of reminders) {
    if (!r.enabled) continue;
    const t = parseTime(r.time);
    if (!t) continue;
    const info = FAITH_REMINDER_INFO[r.kind];
    for (const d of normalizeWeekdays(r.weekdays)) {
      out.push({ id: ID_BASE[r.kind] + d, title: info.title, body: info.body, on: { weekday: toCapacitorWeekday(d), hour: t.hour, minute: t.minute } });
    }
  }
  return out;
}

/** "Every day at 6:30 AM", "Mon, Wed and Fri at 8:00 PM". */
export function describeFaithReminder(r: Pick<FaithReminder, "time" | "weekdays">): string {
  const t = parseTime(r.time);
  const days = normalizeWeekdays(r.weekdays);
  const list =
    days.length === 7
      ? "Every day"
      : (() => {
          const names = WEEKDAY_LABELS.filter((w) => days.includes(w.day)).map((w) => w.short);
          return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
        })();
  if (!t) return list;
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${list} at ${h12}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"}`;
}
