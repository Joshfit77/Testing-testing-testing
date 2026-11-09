import type { ProgramSchedule } from "@/server/services/schedule";
import type { ActiveProgram } from "@/server/services/training";

/** Where "start today's workout" goes, and whether a program session is due today. */
export interface TodayWorkoutLink {
  /** The program day's start link, or an empty workout when no program day is up next. */
  href: string;
  /** A program session is up next and planned for today (not moved to a later day). */
  due: boolean;
  /** The program day's name when there is one. */
  name: string | null;
}

export const BLANK_WORKOUT_HREF = "/train/workout?blank=1";

/** The same start link Home's "Start today's workout" uses, for Home and Quick add. */
export function todayWorkoutLink(active: ActiveProgram | null, schedule: Pick<ProgramSchedule, "planned"> | null, todayIso: string): TodayWorkoutLink {
  const day = active?.today ?? null;
  if (!active || !day) return { href: BLANK_WORKOUT_HREF, due: false, name: null };
  const next = schedule?.planned[0];
  const plannedLater = Boolean(next && next.dayId === day.id && next.date > todayIso);
  return { href: `/train/workout?day=${day.id}&up=${active.userProgramId}`, due: !plannedLater, name: day.name };
}
