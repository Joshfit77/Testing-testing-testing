/**
 * Saved custom workouts ("templates", SPEC §6): an ordered list of exercises with sets, a target (reps, time
 * or distance), rest and optional supersets. Pure helpers shared by the template editor, the logger ("Save as
 * template") and the server.
 */
import { distanceMode, distanceUnit, fromMetres, usesDistance } from "./exercise-tracking";
import type { UnitSystem } from "./types";
import type { WorkoutDraft } from "./workout-draft";

export const TEMPLATE_TARGETS = ["reps", "time", "distance"] as const;
export type TemplateTarget = (typeof TEMPLATE_TARGETS)[number];

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  target: TemplateTarget;
  reps: string | null;
  durationSeconds: number | null;
  distanceM: number | null;
  restSeconds: number;
  /** Neighbouring exercises with the same number form a superset. */
  supersetGroup: number | null;
  notes: string | null;
}

export interface TemplateInput {
  name: string;
  notes: string | null;
  exercises: TemplateExercise[];
}

/**
 * Superset groups are runs of two or more neighbouring exercises. Lone members lose their group and groups are
 * renumbered 1, 2, 3… in order, so the stored numbers are always tidy.
 */
export function normalizeTemplateGroups<T extends { supersetGroup: number | null }>(exercises: T[]): T[] {
  const out = exercises.map((e) => ({ ...e }));
  let next = 1;
  let i = 0;
  while (i < out.length) {
    const g = out[i]!.supersetGroup;
    if (g == null) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && out[j + 1]!.supersetGroup === g) j++;
    const value = j > i ? next++ : null;
    for (let k = i; k <= j; k++) out[k]!.supersetGroup = value;
    i = j + 1;
  }
  return out;
}

/** Superset letter for display: group 1 → "A". */
export const supersetLetter = (group: number) => String.fromCharCode(64 + Math.min(26, Math.max(1, group)));

/** The default target for an exercise: distance for carries/sleds/runs, time for timed moves, else reps. */
export function defaultTarget(ex: { slug: string; isTimed: boolean }): TemplateTarget {
  if (usesDistance(ex.slug)) return "distance";
  return ex.isTimed ? "time" : "reps";
}

/**
 * Turn a workout (e.g. an empty workout you just finished) into a template: same order and supersets, one
 * template set per working set, and the reps / time / distance you actually did on the first working set.
 */
export function templateFromDraft(draft: Pick<WorkoutDraft, "name" | "notes" | "exercises">): TemplateInput {
  const groups = new Map<string, number>();
  const exercises: TemplateExercise[] = draft.exercises
    .filter((e) => !e.skipped)
    .map((e) => {
      const working = e.sets.filter((s) => !s.isWarmup);
      const done = working.filter((s) => s.completed);
      const ref = done[0] ?? working[0] ?? e.sets[0] ?? null;
      let target: TemplateTarget = e.usesDistance && (ref?.distanceM ?? e.target?.distanceM) ? "distance" : e.isTimed ? "time" : "reps";
      const reps = ref?.reps ?? (e.target?.reps ? Number.parseInt(e.target.reps, 10) || null : null);
      const duration = ref?.durationSeconds ?? e.target?.seconds ?? null;
      const distance = ref?.distanceM ?? e.target?.distanceM ?? null;
      if (target === "reps" && reps == null) target = duration ? "time" : "reps";
      if (target === "time" && !duration) target = distance ? "distance" : "reps";
      let group: number | null = null;
      if (e.supersetId) {
        if (!groups.has(e.supersetId)) groups.set(e.supersetId, groups.size + 1);
        group = groups.get(e.supersetId)!;
      }
      return {
        exerciseId: e.exerciseId,
        sets: Math.max(1, Math.min(20, (done.length || working.length || 1))),
        target,
        reps: target === "reps" ? String(reps ?? e.target?.reps ?? 10).slice(0, 20) : null,
        durationSeconds: target === "time" ? Math.max(5, Math.min(7200, Math.round(duration ?? 30))) : null,
        distanceM: target === "distance" ? Math.max(1, Math.min(100000, distance ?? 20)) : null,
        restSeconds: Math.max(0, Math.min(900, Math.round(e.restSeconds))),
        supersetGroup: group,
        notes: e.notes.trim() ? e.notes.trim().slice(0, 500) : null,
      };
    })
    .slice(0, 40);
  return { name: (draft.name.trim() || "My workout").slice(0, 120), notes: draft.notes.trim() ? draft.notes.trim().slice(0, 2000) : null, exercises: normalizeTemplateGroups(exercises) };
}

/** Text for one template exercise: "3 × 8-12 · rest 90 s", "3 × 0:45", "4 × 40 m". */
export function prescriptionText(e: Pick<TemplateExercise, "sets" | "target" | "reps" | "durationSeconds" | "distanceM">, distance: (m: number) => string, duration: (s: number) => string): string {
  const what = e.target === "reps" ? (e.reps ?? "") : e.target === "time" ? duration(e.durationSeconds ?? 0) : distance(e.distanceM ?? 0);
  return `${e.sets} × ${what}`;
}

// --------------------------------------------------------------------------- Template editor state

export interface EditorExercise {
  key: string;
  exerciseId: string;
  slug: string;
  name: string;
  isTimed: boolean;
  sets: number;
  target: TemplateTarget;
  reps: string;
  seconds: string;
  /** Distance as typed, in the exercise's display unit. */
  distance: string;
  restSeconds: number;
  supersetGroup: number | null;
}

export interface EditorValue {
  name: string;
  notes: string;
  exercises: EditorExercise[];
}

export const REST_OPTIONS = [0, 15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

let keySeq = 0;
export const nextEditorKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function distanceUnitFor(slug: string, units: UnitSystem) {
  return distanceUnit(distanceMode(slug) ?? "loaded", units);
}

/** Build the editor value from saved template exercises (distances converted to the display unit). */
export function toEditorValue(
  t: { name: string; notes: string | null; exercises: { exerciseId: string; slug: string; name: string; isTimed: boolean; sets: number; target: TemplateTarget; reps: string | null; durationSeconds: number | null; distanceM: number | null; restSeconds: number; supersetGroup: number | null }[] },
  units: UnitSystem,
): EditorValue {
  return {
    name: t.name,
    notes: t.notes ?? "",
    exercises: t.exercises.map((e) => ({
      key: nextEditorKey(),
      exerciseId: e.exerciseId,
      slug: e.slug,
      name: e.name,
      isTimed: e.isTimed,
      sets: e.sets,
      target: e.target,
      reps: e.reps ?? "",
      seconds: e.durationSeconds ? String(e.durationSeconds) : "",
      distance: e.distanceM ? String(fromMetres(e.distanceM, distanceUnitFor(e.slug, units))) : "",
      restSeconds: e.restSeconds,
      supersetGroup: e.supersetGroup,
    })),
  };
}

