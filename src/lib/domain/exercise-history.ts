/**
 * An exercise's performance history (SPEC §6: links from an exercise to its history): every completed session
 * that included it, the best set, and the best estimated 1RM per session (Epley) for the trend line.
 */
import type { PreviousSet } from "./previous-performance";
import { estimateOneRepMax } from "./strength";

export interface HistoryRow {
  skipped: boolean;
  session: { id: string; name: string; started_at: string; status: string } | null;
  sets: { set_number: number; reps: number | null; weight_kg: number | string | null; duration_seconds: number | null; distance_m: number | string | null; is_warmup: boolean; completed: boolean }[];
}

export interface HistorySession {
  sessionId: string;
  name: string;
  date: string;
  sets: PreviousSet[];
  /** Best estimated 1RM of the session's working sets (kg), when any set allows one. */
  e1rmKg: number | null;
}

export type BestSet =
  | { kind: "e1rm"; weightKg: number; reps: number; e1rmKg: number; date: string; sessionId: string }
  | { kind: "reps"; reps: number; date: string; sessionId: string }
  | { kind: "duration"; seconds: number; date: string; sessionId: string }
  | { kind: "distance"; metres: number; weightKg: number | null; date: string; sessionId: string };

export interface ExerciseHistory {
  sessions: HistorySession[];
  best: BestSet | null;
  trend: { date: string; e1rmKg: number }[];
}

export function buildExerciseHistory(rows: HistoryRow[]): ExerciseHistory {
  const bySession = new Map<string, HistorySession>();
  for (const r of rows) {
    if (r.skipped || !r.session || r.session.status !== "completed") continue;
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
    const existing = bySession.get(r.session.id);
    if (existing) existing.sets.push(...sets);
    else bySession.set(r.session.id, { sessionId: r.session.id, name: r.session.name, date: r.session.started_at, sets, e1rmKg: null });
  }
  const sessions = [...bySession.values()].filter((s) => s.sets.some((x) => x.completed && !x.isWarmup));
  let best: BestSet | null = null;
  const better = (b: BestSet) => {
    if (!best) return true;
    if (b.kind === "e1rm") return best.kind !== "e1rm" || b.e1rmKg > best.e1rmKg;
    if (best.kind === "e1rm") return false;
    if (b.kind === "distance") return best.kind !== "distance" || b.metres > best.metres || (b.metres === best.metres && (b.weightKg ?? 0) > (best.weightKg ?? 0));
    if (best.kind === "distance") return false;
    if (b.kind === "duration") return best.kind !== "duration" || b.seconds > best.seconds;
    if (best.kind === "duration") return false;
    return b.reps > best.reps;
  };
  for (const s of sessions) {
    for (const x of s.sets) {
      if (!x.completed || x.isWarmup) continue;
      const w = x.weightKg ?? 0;
      const reps = x.reps ?? 0;
      const e1 = w > 0 && reps > 0 ? estimateOneRepMax(w, reps) : null;
      if (e1 != null) {
        s.e1rmKg = Math.max(s.e1rmKg ?? 0, e1);
        const cand: BestSet = { kind: "e1rm", weightKg: w, reps, e1rmKg: e1, date: s.date, sessionId: s.sessionId };
        if (better(cand)) best = cand;
      } else if (x.distanceM != null && x.distanceM > 0) {
        const cand: BestSet = { kind: "distance", metres: x.distanceM, weightKg: x.weightKg, date: s.date, sessionId: s.sessionId };
        if (better(cand)) best = cand;
      } else if (x.durationSeconds != null && x.durationSeconds > 0 && !reps) {
        const cand: BestSet = { kind: "duration", seconds: x.durationSeconds, date: s.date, sessionId: s.sessionId };
        if (better(cand)) best = cand;
      } else if (reps > 0) {
        const cand: BestSet = { kind: "reps", reps, date: s.date, sessionId: s.sessionId };
        if (better(cand)) best = cand;
      }
    }
  }
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  const trend = sessions
    .filter((s) => s.e1rmKg != null)
    .map((s) => ({ date: s.date, e1rmKg: s.e1rmKg! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { sessions, best, trend };
}
