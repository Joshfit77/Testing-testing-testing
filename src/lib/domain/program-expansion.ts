import type { ProgramDaySeed, ProgramExerciseSeed, ProgramSeed } from "@/data/programs";
import { estimateSessionMinutes } from "./session-time";

export interface ExpandedExercise extends ProgramExerciseSeed {
  position: number;
}
export interface ExpandedDay {
  dayNumber: number;
  name: string;
  focus: string;
  minutes: number;
  warmup: string[];
  cooldown: string[];
  exercises: ExpandedExercise[];
}
export interface ExpandedWeek {
  weekNumber: number;
  focus: string;
  isDeload: boolean;
  days: ExpandedDay[];
}

const clampRpe = (n: number) => Math.min(9.5, Math.max(4, Math.round(n * 2) / 2));

function loadingWeeks(seed: ProgramSeed): number {
  return seed.deloadFinalWeek && seed.weeks > 1 ? seed.weeks - 1 : seed.weeks;
}

/** Second half of the loading weeks: volume_wave programs add a set here. */
function isVolumePhase(seed: ProgramSeed, week: number): boolean {
  return week > Math.ceil(loadingWeeks(seed) / 2);
}

function weekFocus(seed: ProgramSeed, week: number, isDeload: boolean): string {
  if (isDeload) return "Deload — reduce volume and intensity to recover and consolidate";
  if (seed.weeks === 1) return "Complete each session once this week";
  if (week === 1) return "Establish technique and baseline loads";
  switch (seed.progressionModel) {
    case "linear_rpe":
      return week >= seed.weeks - 2 ? "Push intensity while keeping form crisp" : "Add load in small increments";
    case "volume_wave":
      return isVolumePhase(seed, week) ? "Build volume: one extra set on most exercises" : "Own the reps: add load when you reach the top of the range";
    case "density":
      return "Increase density: an extra round or shorter rest on conditioning; lifts stay crisp";
    default:
      return "Repeat and refine — small improvements count";
  }
}

function adjustExercise(ex: ProgramExerciseSeed, seed: ProgramSeed, week: number, isDeload: boolean): ProgramExerciseSeed {
  const out: ProgramExerciseSeed = { ...ex };
  if (isDeload) {
    out.sets = Math.max(1, Math.round(ex.sets * 0.6));
    if (ex.rpe) out.rpe = clampRpe(ex.rpe - 2);
    out.notes = [ex.notes, "Deload: use ~60% of your recent working loads."].filter(Boolean).join(" ");
    return out;
  }
  const step = week - 1;
  // Multi-set work tops out at RPE 9 (about one rep in reserve); grinding every set to RPE 9.5+ builds fatigue faster than strength.
  const cap = (n: number) => Math.min(ex.sets > 1 ? 9 : 9.5, clampRpe(n));
  switch (seed.progressionModel) {
    case "linear_rpe":
      if (ex.rpe) out.rpe = cap(Math.max(ex.rpe, ex.rpe + Math.min(step, 4) * 0.5));
      break;
    case "volume_wave":
      // Accumulation: the first half of the block adds load/reps at the same sets; the second half adds a set.
      if (isVolumePhase(seed, week) && ex.reps && ex.sets < 5) out.sets = ex.sets + 1;
      if (ex.rpe) out.rpe = cap(ex.rpe + Math.floor(step / 2) * 0.5);
      break;
    case "density": {
      // Only timed conditioning gets denser. Strength sets keep their full rest, and short all-out efforts
      // (10 s or less) keep long rests so every rep stays maximal.
      const conditioning = Boolean(ex.seconds) && !ex.reps && (ex.seconds ?? 0) > 10 && ex.rest > 0;
      if (conditioning) {
        if (ex.rest >= 40) out.rest = Math.max(30, ex.rest - Math.min(step, 3) * 10);
        if (step >= 2 && ex.sets > 1 && ex.sets < 10) out.sets = ex.sets + 1;
      } else if (ex.rpe) out.rpe = Math.max(ex.rpe, cap(Math.min(8, ex.rpe + Math.min(step, 2) * 0.5)));
      break;
    }
    case "steady":
      break;
  }
  return out;
}

/** Expand a program's weekly template into concrete weeks with progression applied. */
export function expandProgram(seed: ProgramSeed): ExpandedWeek[] {
  if (seed.weekTemplates) {
    if (seed.weekTemplates.length !== seed.weeks) {
      throw new Error(`Program ${seed.slug} has ${seed.weekTemplates.length} week templates but ${seed.weeks} weeks`);
    }
    return seed.weekTemplates.map((wk, wi) => ({
      weekNumber: wi + 1,
      focus: wk.focus,
      isDeload: Boolean(wk.isDeload),
      days: wk.days.map((d, i) => ({
        dayNumber: i + 1,
        name: d.name,
        focus: d.focus,
        minutes: d.minutes,
        warmup: d.warmup ?? seed.warmup,
        cooldown: d.cooldown ?? seed.cooldown,
        exercises: d.exercises.map((ex, position) => ({ ...ex, position })),
      })),
    }));
  }
  const weeks: ExpandedWeek[] = [];
  for (let w = 1; w <= seed.weeks; w++) {
    const isDeload = Boolean(seed.deloadFinalWeek && seed.weeks > 1 && w === seed.weeks);
    weeks.push({
      weekNumber: w,
      focus: weekFocus(seed, w, isDeload),
      isDeload,
      days: seed.days.map((d: ProgramDaySeed, i) => {
        let exercises = d.exercises.map((ex, position) => ({ ...adjustExercise(ex, seed, w, isDeload), position }));
        // Keep the stated length honest as sets change (extra sets add time, deloads take less).
        let delta = estimateSessionMinutes(exercises) - estimateSessionMinutes(d.exercises);
        // A chosen session length caps progression: no extra sets that would run past it.
        if (seed.maxSessionMinutes && delta > 0 && d.minutes + delta > seed.maxSessionMinutes) {
          exercises = exercises.map((e, i) => ({ ...e, sets: Math.min(e.sets, d.exercises[i]!.sets) }));
          delta = estimateSessionMinutes(exercises) - estimateSessionMinutes(d.exercises);
        }
        const rounded = delta === 0 ? d.minutes : Math.max(10, Math.round((d.minutes + delta) / 5) * 5);
        const minutes = seed.maxSessionMinutes && delta <= 0 ? Math.min(rounded, Math.max(d.minutes, seed.maxSessionMinutes)) : rounded;
        return {
          dayNumber: i + 1,
          name: d.name,
          focus: d.focus,
          minutes,
          warmup: d.warmup ?? seed.warmup,
          cooldown: d.cooldown ?? seed.cooldown,
          exercises,
        };
      }),
    });
  }
  return weeks;
}

export function intensityLabel(ex: Pick<ProgramExerciseSeed, "rpe" | "intensity">): string | null {
  if (ex.intensity && ex.rpe) return `${ex.intensity} · RPE ${ex.rpe}`;
  if (ex.intensity) return ex.intensity;
  if (ex.rpe) return `RPE ${ex.rpe}`;
  return null;
}
