import { addDays, daysBetween } from "@/lib/domain/dates";

/**
 * Habit programs: nutrition, faith-and-fitness and lifestyle programs built from daily and weekly activities instead
 * of sets and reps (src/data/habit-programs). Pure helpers: day numbering, what's due on a day, progress and the
 * completion criteria. There is no restart rule: a missed day stays missed and the member carries on.
 */

export type HabitActivityKind =
  | "lesson" // read this week's short lesson
  | "track_food" // log what you eat today
  | "protein" // reach your protein goal
  | "water" // reach your water goal
  | "vegetables" // eat vegetables or fruit at two meals
  | "meal_plan" // plan the week's meals
  | "grocery" // build and shop the grocery list
  | "meal_prep" // batch-cook or prepare food
  | "workout" // complete a workout (any, or the linked program's session)
  | "walk" // walk or light activity for a set time
  | "mobility" // a short mobility routine
  | "sleep" // a sleep habit (wind-down, consistent wake time)
  | "scripture" // optional Bible reading (in the app's existing translation)
  | "prayer" // optional prayer time
  | "reflection" // optional reflection, written in the private prayer journal
  | "checkin" // weekly check-in question(s)
  | "habit"; // any other small daily habit

export interface HabitActivity {
  /** Stable key, unique within the program: lowercase letters, digits, - and _. */
  key: string;
  kind: HabitActivityKind;
  title: string;
  detail?: string;
  /** Where in the app to do it (e.g. "/nutrition", "/faith/bible/JHN/1"). */
  href?: string;
  /** Optional activities are offered but never count against completion. */
  optional?: boolean;
  /** Only on these days of the week (1 = the program's first day of each week … 7). Default: every day. */
  onDays?: number[];
  /** Weekly check-in questions answered in a few words (kept with the program, never in the journal). */
  questions?: string[];
}

export interface HabitWeek {
  week: number;
  title: string;
  objective: string;
  lesson: { title: string; body: string[] };
  /** Daily activities for this week (each filtered by onDays). */
  daily: HabitActivity[];
  /** Done once in the week (on any day). */
  weekly: HabitActivity[];
  milestone: string;
}

export type HabitCategory = "nutrition" | "faith_fitness" | "lifestyle";

export interface HabitGoalField {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  help: string;
}

export interface HabitProgram {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: HabitCategory;
  level: "beginner" | "intermediate" | "all";
  /** Total days (e.g. 28, 84, 90). Weeks are counted in 7-day blocks from the start date. */
  days: number;
  schedule: string;
  equipment: string[];
  /** Instructions shown before starting. */
  instructions: string[];
  /** Goals the member can adjust (protein grams, water, daily walk minutes...). */
  goalFields: HabitGoalField[];
  weeks: HabitWeek[];
  /** Share of required activities to complete the program (0–1), and how it is explained. */
  completion: { minShare: number; text: string };
  /** Training program this one pairs with (its sessions count as the "workout" activities). */
  linkedProgramSlug?: string;
  /** Should be checked by a registered dietitian (nutrition) or other qualified professional before release. */
  needsProfessionalReview?: { who: string; why: string };
  /** Shown on faith programs: physical performance is never a measure of spiritual standing. */
  faithNote?: string;
}

/** Day number (1-based) of `today` for an enrollment started on `startedOn`; 0 before it starts. */
export function habitDayNumber(startedOn: string, today: string): number {
  const d = daysBetween(startedOn, today) + 1;
  return d < 1 ? 0 : d;
}

export function weekOfDay(day: number): number {
  return Math.ceil(day / 7);
}

export function dayInWeek(day: number): number {
  return ((day - 1) % 7) + 1;
}

export function dateOfDay(startedOn: string, day: number): string {
  return addDays(startedOn, day - 1);
}

export function weekFor(program: HabitProgram, day: number): HabitWeek | null {
  const w = Math.min(weekOfDay(day), program.weeks.length);
  return program.weeks.find((x) => x.week === w) ?? null;
}

/** The activities due on a given day: that week's daily items for this weekday, plus the weekly items. */
export function activitiesForDay(program: HabitProgram, day: number): { daily: HabitActivity[]; weekly: HabitActivity[] } {
  if (day < 1 || day > program.days) return { daily: [], weekly: [] };
  const week = weekFor(program, day);
  if (!week) return { daily: [], weekly: [] };
  const dow = dayInWeek(day);
  return { daily: week.daily.filter((a) => !a.onDays || a.onDays.includes(dow)), weekly: week.weekly };
}

export interface CheckinRow {
  day_number: number;
  activity_key: string;
}

/** Weekly items are recorded on the day they were done; this says whether one is done anywhere in its week. */
export function weeklyDone(checkins: CheckinRow[], week: number, key: string): boolean {
  return checkins.some((c) => weekOfDay(c.day_number) === week && c.activity_key === key);
}

export function dailyDone(checkins: CheckinRow[], day: number, key: string): boolean {
  return checkins.some((c) => c.day_number === day && c.activity_key === key);
}

export interface HabitProgress {
  currentDay: number;
  /** Required (non-optional) activities due up to and including the current day, and how many are done. */
  required: number;
  done: number;
  share: number;
  /** Required activities over the whole program. */
  totalRequired: number;
  totalDone: number;
  /** Completion criteria met (program over and share reached, or every required item done). */
  complete: boolean;
  finished: boolean;
}

function requiredItems(program: HabitProgram, upToDay: number): { day: number; week: number; key: string; weekly: boolean }[] {
  const out: { day: number; week: number; key: string; weekly: boolean }[] = [];
  const seenWeekly = new Set<string>();
  for (let d = 1; d <= Math.min(upToDay, program.days); d++) {
    const { daily, weekly } = activitiesForDay(program, d);
    for (const a of daily) if (!a.optional) out.push({ day: d, week: weekOfDay(d), key: a.key, weekly: false });
    for (const a of weekly) {
      const id = `${weekOfDay(d)}:${a.key}`;
      if (a.optional || seenWeekly.has(id)) continue;
      seenWeekly.add(id);
      out.push({ day: d, week: weekOfDay(d), key: a.key, weekly: true });
    }
  }
  return out;
}

export function habitProgress(program: HabitProgram, startedOn: string, today: string, checkins: CheckinRow[]): HabitProgress {
  const currentDay = Math.min(habitDayNumber(startedOn, today), program.days);
  const isDone = (i: { day: number; week: number; key: string; weekly: boolean }) => (i.weekly ? weeklyDone(checkins, i.week, i.key) : dailyDone(checkins, i.day, i.key));
  const sofar = requiredItems(program, currentDay);
  const all = requiredItems(program, program.days);
  const done = sofar.filter(isDone).length;
  const totalDone = all.filter(isDone).length;
  const finished = habitDayNumber(startedOn, today) > program.days;
  const totalShare = all.length ? totalDone / all.length : 1;
  return {
    currentDay,
    required: sofar.length,
    done,
    share: sofar.length ? done / sofar.length : 0,
    totalRequired: all.length,
    totalDone,
    complete: totalDone === all.length || (finished && totalShare >= program.completion.minShare),
    finished,
  };
}

/** Validation used by tests and at build time: a program's structure is internally consistent. */
export function validateHabitProgram(p: HabitProgram): string[] {
  const errors: string[] = [];
  const weeksNeeded = Math.ceil(p.days / 7);
  if (p.weeks.length !== weeksNeeded) errors.push(`${p.slug}: ${p.weeks.length} weeks defined, ${weeksNeeded} needed for ${p.days} days`);
  p.weeks.forEach((w, i) => {
    if (w.week !== i + 1) errors.push(`${p.slug}: week ${i + 1} numbered ${w.week}`);
    if (!w.objective || !w.milestone || !w.lesson.title || !w.lesson.body.length) errors.push(`${p.slug}: week ${w.week} missing objective, milestone or lesson`);
    const keys = [...w.daily, ...w.weekly].map((a) => a.key);
    if (new Set(keys).size !== keys.length) errors.push(`${p.slug}: week ${w.week} repeats an activity key`);
    for (const a of [...w.daily, ...w.weekly]) {
      if (!/^[a-z0-9_-]{1,48}$/.test(a.key)) errors.push(`${p.slug}: bad key ${a.key}`);
      if (a.onDays?.some((d) => d < 1 || d > 7)) errors.push(`${p.slug}: ${a.key} has an invalid weekday`);
      if ((a.kind === "scripture" || a.kind === "prayer" || a.kind === "reflection") && !a.optional) errors.push(`${p.slug}: faith activity ${a.key} must be optional`);
    }
    if (!w.daily.length && !w.weekly.length) errors.push(`${p.slug}: week ${w.week} has no activities`);
  });
  if (p.completion.minShare <= 0 || p.completion.minShare > 1) errors.push(`${p.slug}: completion share out of range`);
  for (const g of p.goalFields) if (!(g.min <= g.default && g.default <= g.max)) errors.push(`${p.slug}: goal ${g.key} default out of range`);
  return errors;
}
