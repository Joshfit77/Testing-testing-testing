/**
 * "Last time: 3×5 @ 225 lb" — the previous performance shown beside each exercise in the logger (SPEC §6).
 * Pure: the server finds the most recent completed session containing the exercise; this turns its sets into a
 * short line. Only completed working sets count (warm-ups and unfinished sets are left out).
 */
import { formatDistance } from "./exercise-tracking";
import type { UnitSystem } from "./types";
import { displayWeight, formatDuration, weightUnit } from "./units";

export interface PreviousSet {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  isWarmup: boolean;
  completed: boolean;
}

export interface PreviousPerformance {
  exerciseId: string;
  /** ISO time the session started. */
  date: string;
  sessionId: string;
  sets: PreviousSet[];
}

/** Rows of workout_exercises (with their session and sets), newest first or in any order. */
export interface PreviousRow {
  exercise_id: string;
  skipped: boolean;
  session: { id: string; started_at: string; status: string } | null;
  sets: { set_number: number; reps: number | null; weight_kg: number | string | null; duration_seconds: number | null; distance_m: number | string | null; is_warmup: boolean; completed: boolean }[];
}

/**
 * The latest completed session per exercise, with at least one completed working set. A session that logged
 * the same exercise twice has its sets combined, in order.
 */
export function latestPerformances(rows: PreviousRow[], excludeSessionId?: string | null): Map<string, PreviousPerformance> {
  const usable = rows.filter((r) => !r.skipped && r.session && r.session.status === "completed" && r.session.id !== excludeSessionId);
  usable.sort((a, b) => b.session!.started_at.localeCompare(a.session!.started_at));
  const out = new Map<string, PreviousPerformance>();
  for (const r of usable) {
    const sets: PreviousSet[] = [...r.sets]
      .sort((a, b) => a.set_number - b.set_number)
      .map((s) => ({
        reps: s.reps,
        weightKg: s.weight_kg == null ? null : Number(s.weight_kg),
        durationSeconds: s.duration_seconds,
        distanceM: s.distance_m == null ? null : Number(s.distance_m),
        isWarmup: s.is_warmup,
        completed: s.completed,
      }));
    const existing = out.get(r.exercise_id);
    if (existing) {
      if (existing.sessionId === r.session!.id) existing.sets.push(...sets);
      continue;
    }
    if (!sets.some((s) => s.completed && !s.isWarmup)) continue;
    out.set(r.exercise_id, { exerciseId: r.exercise_id, date: r.session!.started_at, sessionId: r.session!.id, sets });
  }
  return out;
}

const weightText = (kg: number, units: UnitSystem) => {
  const v = displayWeight(kg, units);
  return `${Number.isInteger(Math.round(v * 10) / 10) ? Math.round(v) : v} ${weightUnit(units)}`;
};

/** One working set as text: "225 lb × 5", "8 reps", "0:45", "40 m · 0:30". */
function setText(s: PreviousSet, units: UnitSystem, timed: boolean): string {
  const parts: string[] = [];
  if (s.weightKg != null && s.weightKg > 0) parts.push(weightText(s.weightKg, units));
  if (s.distanceM != null && s.distanceM > 0) parts.push(formatDistance(s.distanceM, units));
  if (timed || (s.reps == null && s.durationSeconds != null)) parts.push(formatDuration(s.durationSeconds ?? 0));
  else if (s.reps != null) parts.push(`${s.reps} reps`);
  return parts.join(" · ");
}

/**
 * Summary of the working sets: "3×5 @ 225 lb" when every set matched, "5, 5, 4 @ 225 lb" when only the
 * reps differed, "3×12" for bodyweight sets, "2 × 0:45" for timed sets, "3 × 40 m @ 100 lb" for carries, or
 * a list of up to four sets otherwise. Null when there's nothing to show.
 */
export function summarizeSets(all: PreviousSet[], units: UnitSystem, timed: boolean): string | null {
  const sets = all.filter((s) => s.completed && !s.isWarmup);
  if (!sets.length) return null;
  const n = sets.length;
  const same = <K extends keyof PreviousSet>(k: K) => sets.every((s) => s[k] === sets[0]![k]);
  const w = sets[0]!.weightKg;
  const at = w != null && w > 0 ? ` @ ${weightText(w, units)}` : "";
  const hasDistance = sets.some((s) => s.distanceM != null && s.distanceM > 0);
  if (hasDistance && same("distanceM") && same("weightKg")) {
    const time = !timed || !same("durationSeconds") || sets[0]!.durationSeconds == null ? "" : ` in ${formatDuration(sets[0]!.durationSeconds)}`;
    return `${n} × ${formatDistance(sets[0]!.distanceM!, units)}${time}${at}`;
  }
  if (!hasDistance && timed && same("durationSeconds") && same("weightKg")) return `${n} × ${formatDuration(sets[0]!.durationSeconds ?? 0)}${at}`;
  if (!hasDistance && !timed && same("weightKg") && sets.every((s) => s.reps != null)) {
    if (same("reps")) return `${n}×${sets[0]!.reps}${at}`;
    return `${sets.map((s) => s.reps).join(", ")}${at ? at : " reps"}`;
  }
  const list = sets.slice(0, 4).map((s) => setText(s, units, timed));
  return `${list.join(", ")}${n > 4 ? ` +${n - 4} more` : ""}`;
}

/** "Last time: 3×5 @ 225 lb". */
export function lastTimeText(prev: PreviousPerformance | undefined, units: UnitSystem, timed: boolean): string | null {
  if (!prev) return null;
  const summary = summarizeSets(prev.sets, units, timed);
  return summary ? `Last time: ${summary}` : null;
}
