import { totalVolume } from "./strength";

/**
 * In-progress workout state. This is a pure reducer so it can be unit tested and
 * persisted (localStorage + server snapshot) after every change.
 * Weights are stored in kilograms; the UI converts for display.
 */

export interface DraftSet {
  id: string;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
}

export interface DraftTarget {
  sets: number;
  reps?: string | null;
  seconds?: number | null;
  rpe?: number | null;
  intensity?: string | null;
}

export interface DraftExercise {
  id: string;
  exerciseId: string;
  slug: string;
  name: string;
  isTimed: boolean;
  substitutedFromId: string | null;
  substitutedFromName: string | null;
  notes: string;
  skipped: boolean;
  skipReason: "pain" | "equipment" | "time" | "other" | null;
  restSeconds: number;
  target: DraftTarget | null;
  sets: DraftSet[];
}

export interface WorkoutDraft {
  version: 1;
  clientId: string;
  name: string;
  userProgramId: string | null;
  programDayId: string | null;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  notes: string;
  exercises: DraftExercise[];
  rest: { endsAt: string | null; durationSeconds: number; pausedRemaining: number | null };
  updatedAt: string;
}

export interface ExerciseRef {
  id: string;
  slug: string;
  name: string;
  isTimed: boolean;
}

export type DraftAction =
  | { type: "rename"; name: string }
  | { type: "setNotes"; notes: string }
  | { type: "addExercise"; exercise: ExerciseRef; restSeconds?: number; target?: DraftTarget | null }
  | { type: "removeExercise"; exerciseKey: string }
  | { type: "moveExercise"; exerciseKey: string; direction: -1 | 1 }
  | { type: "substituteExercise"; exerciseKey: string; replacement: ExerciseRef }
  | { type: "skipExercise"; exerciseKey: string; reason: DraftExercise["skipReason"] }
  | { type: "unskipExercise"; exerciseKey: string }
  | { type: "setExerciseNotes"; exerciseKey: string; notes: string }
  | { type: "addSet"; exerciseKey: string }
  | { type: "removeSet"; exerciseKey: string; setId: string }
  | { type: "updateSet"; exerciseKey: string; setId: string; patch: Partial<Omit<DraftSet, "id">> }
  | { type: "toggleSetComplete"; exerciseKey: string; setId: string; now: string }
  | { type: "startRest"; seconds: number; now: string }
  | { type: "adjustRest"; deltaSeconds: number; now: string }
  | { type: "clearRest" }
  | { type: "pause"; now: string }
  | { type: "resume"; now: string };

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // RFC4122-ish fallback for very old browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function emptySet(previous?: DraftSet): DraftSet {
  return {
    id: newId(),
    reps: previous?.reps ?? null,
    weightKg: previous?.weightKg ?? null,
    durationSeconds: previous?.durationSeconds ?? null,
    rpe: null,
    isWarmup: false,
    completed: false,
  };
}

function parseTargetReps(reps: string | null | undefined): number | null {
  if (!reps) return null;
  const m = reps.match(/\d+/);
  return m ? Number.parseInt(m[0], 10) : null;
}

export function createDraft(input: {
  name: string;
  now: string;
  clientId?: string;
  userProgramId?: string | null;
  programDayId?: string | null;
  exercises?: { exercise: ExerciseRef; restSeconds?: number; target?: DraftTarget | null }[];
}): WorkoutDraft {
  let draft: WorkoutDraft = {
    version: 1,
    clientId: input.clientId ?? newId(),
    name: input.name,
    userProgramId: input.userProgramId ?? null,
    programDayId: input.programDayId ?? null,
    startedAt: input.now,
    pausedAt: null,
    pausedSeconds: 0,
    notes: "",
    exercises: [],
    rest: { endsAt: null, durationSeconds: 0, pausedRemaining: null },
    updatedAt: input.now,
  };
  for (const e of input.exercises ?? []) {
    draft = workoutReducer(draft, { type: "addExercise", exercise: e.exercise, restSeconds: e.restSeconds, target: e.target });
  }
  return draft;
}

function mapExercise(draft: WorkoutDraft, key: string, fn: (e: DraftExercise) => DraftExercise): WorkoutDraft {
  return { ...draft, exercises: draft.exercises.map((e) => (e.id === key ? fn(e) : e)) };
}

export function workoutReducer(state: WorkoutDraft, action: DraftAction): WorkoutDraft {
  const next = reduce(state, action);
  return next === state ? state : { ...next, updatedAt: "now" in action ? action.now : new Date().toISOString() };
}

function reduce(state: WorkoutDraft, action: DraftAction): WorkoutDraft {
  switch (action.type) {
    case "rename":
      return { ...state, name: action.name.slice(0, 120) };
    case "setNotes":
      return { ...state, notes: action.notes.slice(0, 2000) };
    case "addExercise": {
      const target = action.target ?? null;
      const setCount = Math.max(1, Math.min(10, target?.sets ?? 3));
      const reps = parseTargetReps(target?.reps);
      const sets: DraftSet[] = Array.from({ length: setCount }, () => ({
        ...emptySet(),
        reps: action.exercise.isTimed ? null : reps,
        durationSeconds: action.exercise.isTimed ? (target?.seconds ?? null) : null,
      }));
      const ex: DraftExercise = {
        id: newId(),
        exerciseId: action.exercise.id,
        slug: action.exercise.slug,
        name: action.exercise.name,
        isTimed: action.exercise.isTimed,
        substitutedFromId: null,
        substitutedFromName: null,
        notes: "",
        skipped: false,
        skipReason: null,
        restSeconds: action.restSeconds ?? 90,
        target,
        sets,
      };
      return { ...state, exercises: [...state.exercises, ex] };
    }
    case "removeExercise":
      return { ...state, exercises: state.exercises.filter((e) => e.id !== action.exerciseKey) };
    case "moveExercise": {
      const idx = state.exercises.findIndex((e) => e.id === action.exerciseKey);
      const to = idx + action.direction;
      if (idx < 0 || to < 0 || to >= state.exercises.length) return state;
      const list = [...state.exercises];
      const [item] = list.splice(idx, 1);
      list.splice(to, 0, item!);
      return { ...state, exercises: list };
    }
    case "substituteExercise":
      return mapExercise(state, action.exerciseKey, (e) => ({
        ...e,
        substitutedFromId: e.substitutedFromId ?? e.exerciseId,
        substitutedFromName: e.substitutedFromName ?? e.name,
        exerciseId: action.replacement.id,
        slug: action.replacement.slug,
        name: action.replacement.name,
        isTimed: action.replacement.isTimed,
        sets: e.sets.map((s) => ({
          ...s,
          weightKg: null,
          completed: false,
          reps: action.replacement.isTimed ? null : s.reps,
          durationSeconds: action.replacement.isTimed ? (s.durationSeconds ?? e.target?.seconds ?? 30) : null,
        })),
      }));
    case "skipExercise":
      return mapExercise(state, action.exerciseKey, (e) => ({ ...e, skipped: true, skipReason: action.reason ?? "other" }));
    case "unskipExercise":
      return mapExercise(state, action.exerciseKey, (e) => ({ ...e, skipped: false, skipReason: null }));
    case "setExerciseNotes":
      return mapExercise(state, action.exerciseKey, (e) => ({ ...e, notes: action.notes.slice(0, 1000) }));
    case "addSet":
      return mapExercise(state, action.exerciseKey, (e) =>
        e.sets.length >= 50 ? e : { ...e, sets: [...e.sets, emptySet(e.sets[e.sets.length - 1])] },
      );
    case "removeSet":
      return mapExercise(state, action.exerciseKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== action.setId) }));
    case "updateSet":
      return mapExercise(state, action.exerciseKey, (e) => ({
        ...e,
        sets: e.sets.map((s) => (s.id === action.setId ? sanitizeSet({ ...s, ...action.patch }) : s)),
      }));
    case "toggleSetComplete": {
      let completedNow = false;
      let rest = 0;
      const toggled = mapExercise(state, action.exerciseKey, (e) => {
        rest = e.restSeconds;
        return {
          ...e,
          sets: e.sets.map((s) => {
            if (s.id !== action.setId) return s;
            completedNow = !s.completed;
            return { ...s, completed: !s.completed };
          }),
        };
      });
      if (completedNow && rest > 0 && !state.pausedAt) {
        return reduce(toggled, { type: "startRest", seconds: rest, now: action.now });
      }
      return toggled;
    }
    case "startRest":
      return {
        ...state,
        rest: {
          durationSeconds: action.seconds,
          endsAt: new Date(Date.parse(action.now) + action.seconds * 1000).toISOString(),
          pausedRemaining: null,
        },
      };
    case "adjustRest": {
      if (!state.rest.endsAt) return state;
      const endsAt = Date.parse(state.rest.endsAt) + action.deltaSeconds * 1000;
      if (endsAt <= Date.parse(action.now)) return { ...state, rest: { endsAt: null, durationSeconds: 0, pausedRemaining: null } };
      return {
        ...state,
        rest: { ...state.rest, endsAt: new Date(endsAt).toISOString(), durationSeconds: Math.max(0, state.rest.durationSeconds + action.deltaSeconds) },
      };
    }
    case "clearRest":
      return { ...state, rest: { endsAt: null, durationSeconds: 0, pausedRemaining: null } };
    case "pause": {
      if (state.pausedAt) return state;
      const remaining = state.rest.endsAt ? Math.max(0, Math.round((Date.parse(state.rest.endsAt) - Date.parse(action.now)) / 1000)) : null;
      return {
        ...state,
        pausedAt: action.now,
        rest: remaining ? { endsAt: null, durationSeconds: state.rest.durationSeconds, pausedRemaining: remaining } : { endsAt: null, durationSeconds: 0, pausedRemaining: null },
      };
    }
    case "resume": {
      if (!state.pausedAt) return state;
      const pausedFor = Math.max(0, Math.round((Date.parse(action.now) - Date.parse(state.pausedAt)) / 1000));
      const remaining = state.rest.pausedRemaining;
      return {
        ...state,
        pausedAt: null,
        pausedSeconds: state.pausedSeconds + pausedFor,
        rest: remaining
          ? { endsAt: new Date(Date.parse(action.now) + remaining * 1000).toISOString(), durationSeconds: state.rest.durationSeconds, pausedRemaining: null }
          : state.rest,
      };
    }
  }
}

function sanitizeNumber(v: number | null, min: number, max: number): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.min(max, Math.max(min, v));
}

function sanitizeSet(s: DraftSet): DraftSet {
  return {
    ...s,
    reps: sanitizeNumber(s.reps, 0, 1000),
    weightKg: sanitizeNumber(s.weightKg, 0, 1500),
    durationSeconds: sanitizeNumber(s.durationSeconds, 0, 86400),
    rpe: sanitizeNumber(s.rpe, 1, 10),
  };
}

/** Active (non-paused) seconds since the workout started. */
export function elapsedSeconds(draft: WorkoutDraft, now: string): number {
  const end = draft.pausedAt ? Date.parse(draft.pausedAt) : Date.parse(now);
  return Math.max(0, Math.round((end - Date.parse(draft.startedAt)) / 1000) - draft.pausedSeconds);
}

export function restRemaining(draft: WorkoutDraft, now: string): number {
  if (draft.rest.pausedRemaining) return draft.rest.pausedRemaining;
  if (!draft.rest.endsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(draft.rest.endsAt) - Date.parse(now)) / 1000));
}

export function draftSummary(draft: WorkoutDraft) {
  const active = draft.exercises.filter((e) => !e.skipped);
  const allSets = active.flatMap((e) => e.sets);
  return {
    exercises: active.length,
    completedSets: allSets.filter((s) => s.completed).length,
    totalSets: allSets.length,
    volumeKg: totalVolume(allSets),
  };
}

/** Basic structural validation for restoring a draft from storage. */
export function isWorkoutDraft(value: unknown): value is WorkoutDraft {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<WorkoutDraft>;
  return (
    v.version === 1 &&
    typeof v.clientId === "string" &&
    typeof v.name === "string" &&
    typeof v.startedAt === "string" &&
    Array.isArray(v.exercises) &&
    typeof v.rest === "object" &&
    v.rest !== null
  );
}

/** Pick whichever draft was modified most recently (local vs server). */
export function newerDraft(a: WorkoutDraft | null, b: WorkoutDraft | null): WorkoutDraft | null {
  if (!a) return b;
  if (!b) return a;
  if (a.clientId !== b.clientId) return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}
