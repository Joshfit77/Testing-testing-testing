/**
 * Training calendar: one list of entries per day combining completed workouts, runs, walks, planned
 * program sessions and rest days (SPEC §3). Pure; ISO dates in the user's time zone.
 */
import { addDays, eachDay, startOfWeek } from "./dates";
import type { PlannedSession } from "./training-schedule";

export type CalendarEntryKind = "workout" | "run" | "walk" | "planned" | "rest";

export interface CalendarEntry {
  kind: CalendarEntryKind;
  /** Stable key: workout/activity id, program day id, or "rest:<date>". */
  id: string;
  date: string;
  title: string;
  detail: string | null;
  href: string | null;
  /** Planned sessions only. */
  planned?: { dayId: string; moved: boolean; defaultDate: string; index: number; week: number; day: number };
}

export interface CalendarDay {
  date: string;
  isToday: boolean;
  isPast: boolean;
  inRange: boolean;
  entries: CalendarEntry[];
}

export interface CompletedItem {
  id: string;
  date: string;
  name: string;
  minutes: number | null;
  distanceM?: number | null;
}

export interface CalendarSources {
  workouts: CompletedItem[];
  runs: CompletedItem[];
  walks: CompletedItem[];
  planned: PlannedSession[];
  /** True when there is an active program: rest days are shown between today and the last planned session. */
  hasProgram: boolean;
}

const ORDER: Record<CalendarEntryKind, number> = { workout: 0, run: 1, walk: 2, planned: 3, rest: 4 };

function distanceLabel(m: number | null | undefined, units: "metric" | "imperial"): string | null {
  if (m == null || m <= 0) return null;
  return units === "metric" ? `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km` : `${(m / 1609.344).toFixed(2)} mi`;
}

/**
 * Merge everything into per-day entries for [from, to]. Completed items always stay on the date they
 * happened. Rest days are only shown from today up to the last planned session, on days with nothing
 * planned or done; past empty days are left blank (we don't label days we know nothing about).
 */
export function buildCalendar(
  sources: CalendarSources,
  range: { from: string; to: string },
  today: string,
  units: "metric" | "imperial" = "imperial",
): CalendarDay[] {
  const byDate = new Map<string, CalendarEntry[]>();
  const add = (e: CalendarEntry) => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  for (const w of sources.workouts)
    add({ kind: "workout", id: w.id, date: w.date, title: w.name, detail: w.minutes ? `${w.minutes} min` : null, href: `/train/history/${w.id}` });
  for (const r of sources.runs)
    add({ kind: "run", id: r.id, date: r.date, title: r.name || "Run", detail: [distanceLabel(r.distanceM, units), r.minutes ? `${r.minutes} min` : null].filter(Boolean).join(" · ") || null, href: `/run/activities/${r.id}` });
  for (const r of sources.walks)
    add({ kind: "walk", id: r.id, date: r.date, title: r.name || "Walk", detail: [distanceLabel(r.distanceM, units), r.minutes ? `${r.minutes} min` : null].filter(Boolean).join(" · ") || null, href: `/run/activities/${r.id}` });
  for (const p of sources.planned)
    add({
      kind: "planned",
      id: p.dayId,
      date: p.date,
      title: p.name,
      detail: [`Week ${p.week} · Day ${p.day}`, p.minutes ? `${p.minutes} min` : null].filter(Boolean).join(" · "),
      href: null,
      planned: { dayId: p.dayId, moved: p.moved, defaultDate: p.defaultDate, index: p.index, week: p.week, day: p.day },
    });

  const lastPlanned = sources.planned.reduce<string | null>((m, p) => (m === null || p.date > m ? p.date : m), null);
  return eachDay(range.from, range.to).map((date) => {
    const entries = [...(byDate.get(date) ?? [])].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
    if (!entries.length && sources.hasProgram && lastPlanned && date >= today && date <= lastPlanned) {
      entries.push({ kind: "rest", id: `rest:${date}`, date, title: "Rest day", detail: null, href: null });
    }
    return { date, isToday: date === today, isPast: date < today, inRange: true, entries };
  });
}

/** Monday-first grid of a month (leading/trailing days from neighbouring months are included and marked). */
export function monthGrid(month: string): { from: string; to: string; first: string; last: string } {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const from = startOfWeek(first);
  const to = addDays(startOfWeek(last), 6);
  return { from, to, first, last };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function isMonth(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v));
}

export function isIsoDate(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));
}
