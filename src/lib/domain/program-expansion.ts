import type { ProgramDaySeed, ProgramExerciseSeed, ProgramSeed } from "@/data/programs";

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

function weekFocus(seed: ProgramSeed, week: number, isDeload: boolean): string {
  if (isDeload) return "Deload — reduce volume and intensity to recover and consolidate";
  if (seed.weeks === 1) return "Complete each session once this week";
  if (week === 1) return "Establish technique and baseline loads";
  switch (seed.progressionModel) {
    case "linear_rpe":
      return week >= seed.weeks - 2 ? "Push intensity while keeping form crisp" : "Add load in small increments";
    case "volume_wave":
      return week % 2 === 0 ? "Build volume: add reps or a set" : "Consolidate: own the reps you added";
    case "density":
      return "Increase density: an extra round or shorter rest";
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
  switch (seed.progressionModel) {
    case "linear_rpe":
      if (ex.rpe) out.rpe = clampRpe(ex.rpe + Math.min(step, 4) * 0.5);
      break;
    case "volume_wave":
      if (week % 2 === 0 && ex.reps && ex.sets < 5) out.sets = ex.sets + 1;
      if (ex.rpe) out.rpe = clampRpe(ex.rpe + Math.floor(step / 2) * 0.5);
      break;
    case "density":
      if (ex.rest >= 40) out.rest = Math.max(30, ex.rest - Math.min(step, 3) * 10);
      if (step >= 2 && ex.sets < 10) out.sets = ex.sets + 1;
      break;
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
      days: seed.days.map((d: ProgramDaySeed, i) => ({
        dayNumber: i + 1,
        name: d.name,
        focus: d.focus,
        minutes: d.minutes,
        warmup: d.warmup ?? seed.warmup,
        cooldown: d.cooldown ?? seed.cooldown,
        exercises: d.exercises.map((ex, position) => ({ ...adjustExercise(ex, seed, w, isDeload), position })),
      })),
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
