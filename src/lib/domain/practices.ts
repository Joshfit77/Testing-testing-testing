/**
 * Daily spiritual practices (SPEC §12). Practices are checked off per day and summarised in gentle,
 * factual words ("You spent time in prayer 4 days this week"). Deliberately NOT here: streaks, scores,
 * points, ranks, percentages or comparisons with other people — spiritual life is not graded (12.18).
 */
import { addDays, startOfWeek } from "./dates";

export const PRESET_PRACTICES = ["scripture", "prayer", "gratitude", "fasting", "worship", "rest"] as const;
export type PresetPractice = (typeof PRESET_PRACTICES)[number];
export type PracticeKind = PresetPractice | "custom";

export const PRACTICE_INFO: Record<PresetPractice, { label: string; hint: string }> = {
  scripture: { label: "Scripture reading", hint: "Read a passage, slowly." },
  prayer: { label: "Prayer", hint: "Time to talk with God and listen." },
  gratitude: { label: "Gratitude", hint: "Name a few gifts from today." },
  fasting: { label: "Fasting", hint: "Only if it's safe for you; check with your doctor if unsure." },
  worship: { label: "Worship", hint: "Song, church, or quiet praise." },
  rest: { label: "Rest / Sabbath", hint: "Unhurried rest, received as a gift." },
};

export function isPresetPractice(v: unknown): v is PresetPractice {
  return typeof v === "string" && (PRESET_PRACTICES as readonly string[]).includes(v);
}

export interface Practice {
  id: string;
  practice: PracticeKind;
  title: string;
}

export interface PracticeCheckin {
  goalId: string;
  date: string;
}

export function practiceLabel(p: Pick<Practice, "practice" | "title">): string {
  return p.practice === "custom" ? p.title : PRACTICE_INFO[p.practice].label;
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** One gentle sentence for a practice done on `n` days (n ≥ 1). */
export function practiceSentence(p: Pick<Practice, "practice" | "title">, n: number, period = "this week"): string {
  switch (p.practice) {
    case "scripture":
      return `You spent time in Scripture ${days(n)} ${period}.`;
    case "prayer":
      return `You spent time in prayer ${days(n)} ${period}.`;
    case "gratitude":
      return `You paused to give thanks ${days(n)} ${period}.`;
    case "fasting":
      return `You set aside time to fast ${days(n)} ${period}.`;
    case "worship":
      return `You made room for worship ${days(n)} ${period}.`;
    case "rest":
      return `You received rest ${days(n)} ${period}.`;
    case "custom":
      return `You made time for “${p.title}” ${days(n)} ${period}.`;
  }
}

export const EMPTY_WEEK_MESSAGE = "Nothing checked off yet this week. There's nothing to catch up on: whenever you're ready, today is a fine place to begin.";

/**
 * Gentle summary lines for the Monday–Sunday week containing `today`. Practices with no days are left
 * out (no "0 days", no comparison); when nothing is checked off, a single kind message is returned.
 */
export function weeklyPracticeSummary(practices: Practice[], checkins: PracticeCheckin[], today: string): string[] {
  const from = startOfWeek(today);
  const to = addDays(from, 6);
  const lines: string[] = [];
  for (const p of practices) {
    const n = new Set(checkins.filter((c) => c.goalId === p.id && c.date >= from && c.date <= to && c.date <= today).map((c) => c.date)).size;
    if (n > 0) lines.push(practiceSentence(p, n));
  }
  return lines.length ? lines : [EMPTY_WEEK_MESSAGE];
}

/** For the history calendar: which practices (labels) were checked off on each date. */
export function practicesByDate(practices: Practice[], checkins: PracticeCheckin[]): Map<string, string[]> {
  const byId = new Map(practices.map((p) => [p.id, practiceLabel(p)]));
  const out = new Map<string, string[]>();
  for (const c of checkins) {
    const label = byId.get(c.goalId);
    if (!label) continue;
    const list = out.get(c.date) ?? [];
    if (!list.includes(label)) list.push(label);
    out.set(c.date, list);
  }
  return out;
}

/** How far back a practice can be checked off (today and the previous 6 days). */
export const CHECKIN_WINDOW_DAYS = 7;

export function canCheckIn(date: string, today: string): boolean {
  return date <= today && date >= addDays(today, -(CHECKIN_WINDOW_DAYS - 1));
}
