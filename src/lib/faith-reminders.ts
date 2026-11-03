/**
 * Faith reminders (SPEC §12): optional reminders, each off by default with its own time and days: devotional, prayer,
 * daily practices, Bible reading, Faith challenge, Fitness goal, memory practice, and two opt-in accountability
 * reminders for a reading journey (an evening check and a final one before midnight).
 *
 * Two kinds of delivery:
 * - weekly repeating notifications (devotional, practices, memory practice), which don't depend on what's done;
 * - dated notifications for the next seven days (reading, prayer, challenge, fitness, accountability, final), so that
 *   one for today can be left out or cancelled once that activity is done: no reminder after completion. Times are
 *   the member's saved time zone (the same clock the journey's midnight uses), and DST is handled by computing each
 *   day's instant separately. Quiet hours suppress anything that would fall inside them.
 *
 * Settings are saved to the account (table faith_reminders) so they follow the user to any device. They
 * are delivered as local notifications by the iPhone / Android app (Capacitor LocalNotifications); a web
 * browser can't deliver them while the site is closed, and the UI says so. Pure helpers only.
 */
import { WEEKDAY_LABELS, parseTime, toCapacitorWeekday, type JsWeekday } from "@/lib/reminders";
import { ACTIVE_TRANSLATION, scriptureText } from "@/data/scripture";

export const FAITH_REMINDER_KINDS = ["reading", "prayer", "challenge", "fitness", "accountability", "final", "devotional", "practices", "memorize"] as const;
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
  reading: {
    label: "Bible reading",
    description: "Today's reading, at a time that suits you. Not sent once it's marked complete.",
    defaultTime: "07:00",
    title: "Today's Bible reading",
    body: "Your reading for today is ready on the Faith tab.",
  },
  challenge: {
    label: "Faith challenge",
    description: "Today's optional challenge. Not sent once it's done.",
    defaultTime: "08:00",
    title: "Today's Faith challenge",
    body: "One small step of faith for today is on the Faith tab.",
  },
  fitness: {
    label: "Fitness goal",
    description: "Today's training, or a reminder that rest counts. Not sent once it's done.",
    defaultTime: "17:30",
    title: "Today's fitness goal",
    body: "Today's training (or rest) is on the Faith tab and in Train.",
  },
  accountability: {
    label: "Evening check",
    description: "Only if today's journey reading or prayer isn't marked yet. For reading journeys.",
    defaultTime: "20:00",
    title: "Reading and prayer",
    body: "Today's Bible reading and prayer aren't marked yet. There's still time today.",
  },
  final: {
    label: "Last call before midnight",
    description: "A final reminder late in the evening, only if today isn't complete. For reading journeys.",
    defaultTime: "22:30",
    title: "Before the day ends",
    body: "Your journey's reading and prayer for today aren't marked yet. The day closes at midnight.",
  },
  memorize: {
    label: "Memory practice",
    description: "A moment to practise the verses you're learning.",
    defaultTime: "19:00",
    title: "Scripture memory",
    body: "A minute with your memory verses is waiting on the Faith tab.",
  },
};

/** Kinds delivered as dated notifications (left out once done). The rest repeat weekly. */
export const TRACKED_KINDS = ["reading", "prayer", "challenge", "fitness", "accountability", "final"] as const satisfies readonly FaithReminderKind[];
export type TrackedKind = (typeof TRACKED_KINDS)[number];
const isTracked = (k: FaithReminderKind): k is TrackedKind => (TRACKED_KINDS as readonly string[]).includes(k);
/** Reminders about the journey's rule itself: only sent while a journey is active. */
const JOURNEY_ONLY: readonly TrackedKind[] = ["accountability", "final"];

const ALL_DAYS: JsWeekday[] = [0, 1, 2, 3, 4, 5, 6];

export function defaultFaithReminder(kind: FaithReminderKind): FaithReminder {
  return { kind, enabled: false, time: FAITH_REMINDER_INFO[kind].defaultTime, weekdays: [...ALL_DAYS] };
}

/**
 * Notification id bases (rest timer 4201, workout reminders 5200–5206). Weekly kinds: base + weekday. Dated kinds:
 * base + days from today (0–6). 5310–5316 were the weekly prayer reminders before prayer became dated; they stay in
 * the cancel list so an older schedule on a device is cleared.
 */
const ID_BASE: Record<FaithReminderKind, number> = { devotional: 5300, prayer: 5410, practices: 5320, reading: 5400, challenge: 5420, fitness: 5430, accountability: 5440, final: 5450, memorize: 5460 };
const LEGACY_PRAYER_IDS = ALL_DAYS.map((d) => 5310 + d);
export const ALL_FAITH_REMINDER_IDS: number[] = [...FAITH_REMINDER_KINDS.flatMap((k) => ALL_DAYS.map((d) => ID_BASE[k] + d)), ...LEGACY_PRAYER_IDS];
/** Today's dated notification id for a kind. */
export const todayReminderId = (k: TrackedKind) => ID_BASE[k];

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

export interface QuietHours {
  /** "HH:MM", local. The quiet period runs from start to end and may cross midnight (22:00–07:00). */
  start: string;
  end: string;
}

/** Is a local "HH:MM" inside the quiet hours? */
export function inQuietHours(time: string, quiet: QuietHours | null | undefined): boolean {
  if (!quiet) return false;
  const m = (t: string) => {
    const p = parseTime(t);
    return p ? p.hour * 60 + p.minute : null;
  };
  const t = m(time);
  const a = m(quiet.start);
  const b = m(quiet.end);
  if (t === null || a === null || b === null || a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/** Weekly local notifications for the enabled weekly reminders (devotional, practices, memory practice). */
export function buildFaithNotifications(reminders: FaithReminder[], quiet?: QuietHours | null): FaithNotification[] {
  const out: FaithNotification[] = [];
  for (const r of reminders) {
    if (!r.enabled || isTracked(r.kind) || inQuietHours(r.time, quiet)) continue;
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

/** The instant a wall-clock time on a calendar date happens in a time zone (DST-aware; a time skipped by a spring-forward change moves an hour later). */
export function instantInZone(date: string, time: string, timeZone: string): Date {
  const t = parseTime(time) ?? { hour: 0, minute: 0 };
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, mo - 1, d, t.hour, t.minute);
  const offset = (ts: number) => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = Object.fromEntries(f.formatToParts(ts).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - ts;
  };
  const c1 = wall - offset(wall);
  const c2 = wall - offset(c1);
  const maps = (c: number) => c + offset(c) === wall;
  // Normally both agree. Around a change, take the one whose local time really is the wall time; in the hour a
  // spring-forward change skips, neither is, and the later one (an hour on) is used.
  if (c1 === c2 || maps(c1)) return new Date(c1);
  if (maps(c2)) return new Date(c2);
  return new Date(Math.max(c1, c2));
}

export interface DatedFaithNotification {
  id: number;
  kind: TrackedKind;
  date: string;
  title: string;
  body: string;
  at: Date;
}

export interface FaithReminderContext {
  /** The member's local date and saved time zone (the journey's clock). */
  today: string;
  timezone: string;
  now: Date;
  /** What's already done today (from the server, or this device right after the tap). */
  done: { reading: boolean; prayer: boolean; challenge: boolean; fitness: boolean };
  journeyActive: boolean;
  quiet?: QuietHours | null;
  /** How many days ahead to schedule (dated kinds). */
  days?: number;
}

const doneFor = (k: TrackedKind, done: FaithReminderContext["done"]) =>
  k === "accountability" || k === "final" ? done.reading && done.prayer : k === "reading" ? done.reading : k === "prayer" ? done.prayer : k === "challenge" ? done.challenge : done.fitness;

/**
 * Dated notifications for the next days (default 7) for the enabled tracked reminders: one per kind per day at most,
 * none in the past, none inside quiet hours, none for today once that activity is done, and the journey reminders
 * only while a journey is active.
 */
export function buildDatedFaithNotifications(reminders: FaithReminder[], ctx: FaithReminderContext): DatedFaithNotification[] {
  const out: DatedFaithNotification[] = [];
  const horizon = Math.min(7, Math.max(1, ctx.days ?? 7));
  for (const r of reminders) {
    if (!r.enabled || !isTracked(r.kind) || !parseTime(r.time) || inQuietHours(r.time, ctx.quiet)) continue;
    if (JOURNEY_ONLY.includes(r.kind) && !ctx.journeyActive) continue;
    const days = normalizeWeekdays(r.weekdays);
    for (let i = 0; i < horizon; i++) {
      const date = addDaysIso(ctx.today, i);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() as JsWeekday;
      if (!days.includes(weekday)) continue;
      if (i === 0 && doneFor(r.kind, ctx.done)) continue;
      const at = instantInZone(date, r.time, ctx.timezone);
      if (at.getTime() <= ctx.now.getTime()) continue;
      const info = FAITH_REMINDER_INFO[r.kind];
      out.push({ id: ID_BASE[r.kind] + i, kind: r.kind, date, title: info.title, body: info.body, at });
    }
  }
  return out;
}

/** Which of today's dated notifications to cancel now that these activities are done. */
export function todayIdsToCancel(done: FaithReminderContext["done"]): number[] {
  return TRACKED_KINDS.filter((k) => doneFor(k, done)).map((k) => ID_BASE[k]);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
