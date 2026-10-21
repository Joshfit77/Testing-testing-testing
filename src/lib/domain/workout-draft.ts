import { totalVolume } from "./strength";
import { usesDistance } from "./exercise-tracking";

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
  /** Metres, for carries, sleds and cardio intervals (draft v2). */
  distanceM: number | null;
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
}

export interface DraftTarget {
  sets: number;
  reps?: string | null;
  seconds?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
  intensity?: string | null;
}

export interface DraftExercise {
  id: string;
  exerciseId: string;
  slug: string;
  name: string;
  isTimed: boolean;
  /** Logs distance (carries, sleds, runs, rows). */
  usesDistance: boolean;
  /**
   * Exercises sharing a superset id (and next to each other) are done as a superset: one set of each in turn,
   * with rest only after the round.
   */
  supersetId: string | null;
  substitutedFromId: string | null;
  substitutedFromName: string | null;
  notes: string;
  skipped: boolean;
  skipReason: "pain" | "equipment" | "time" | "other" | null;
  restSeconds: number;
  target: DraftTarget | null;
  sets: DraftSet[];
}

/** Current persisted format. v1 drafts (no distance, no supersets) are migrated by migrateDraft. */
export const DRAFT_VERSION = 2;

export interface WorkoutDraft {
  version: 2;
  clientId: string;
  name: string;
  userProgramId: string | null;
  programDayId: string | null;
  /** The saved template this workout was started from, if any. */
  templateId: string | null;
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
  | { type: "addExercise"; exercise: ExerciseRef; restSeconds?: number; target?: DraftTarget | null; supersetId?: string | null }
  | { type: "linkSuperset"; exerciseKey: string }
  | { type: "unlinkSuperset"; exerciseKey: string }
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
    distanceM: previous?.distanceM ?? null,
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
  templateId?: string | null;
  /** `supersetGroup`: exercises with the same number (next to each other) become one superset. */
  exercises?: { exercise: ExerciseRef; restSeconds?: number; target?: DraftTarget | null; supersetGroup?: number | null }[];
}): WorkoutDraft {
  let draft: WorkoutDraft = {
    version: 2,
    clientId: input.clientId ?? newId(),
    name: input.name,
    userProgramId: input.userProgramId ?? null,
    programDayId: input.programDayId ?? null,
    templateId: input.templateId ?? null,
    startedAt: input.now,
    pausedAt: null,
    pausedSeconds: 0,
    notes: "",
    exercises: [],
    rest: { endsAt: null, durationSeconds: 0, pausedRemaining: null },
    updatedAt: input.now,
  };
  const groupIds = new Map<number, string>();
  for (const e of input.exercises ?? []) {
    const g = e.supersetGroup ?? null;
    if (g !== null && !groupIds.has(g)) groupIds.set(g, newId());
    // The raw reducer: groups are only complete once every member is added, so normalize at the end.
    draft = reduce(draft, { type: "addExercise", exercise: e.exercise, restSeconds: e.restSeconds, target: e.target, supersetId: g === null ? null : groupIds.get(g)! });
  }
  return { ...draft, exercises: normalizeSupersets(draft.exercises) };
}

function mapExercise(draft: WorkoutDraft, key: string, fn: (e: DraftExercise) => DraftExercise): WorkoutDraft {
  return { ...draft, exercises: draft.exercises.map((e) => (e.id === key ? fn(e) : e)) };
}

export function workoutReducer(state: WorkoutDraft, action: DraftAction): WorkoutDraft {
  const next = reduce(state, action);
  if (next === state) return state;
  const structural = ["addExercise", "removeExercise", "moveExercise", "linkSuperset", "unlinkSuperset"].includes(action.type);
  return { ...next, exercises: structural ? normalizeSupersets(next.exercises) : next.exercises, updatedAt: "now" in action ? action.now : new Date().toISOString() };
}

/**
 * Superset groups must be runs of two or more neighbouring exercises. Anything else (a lone member after a
 * removal, or a member moved away from its group) is split off.
 */
export function normalizeSupersets(exercises: DraftExercise[]): DraftExercise[] {
  const out = exercises.map((e) => ({ ...e }));
  const used = new Set<string>();
  let i = 0;
  while (i < out.length) {
    const id = out[i]!.supersetId;
    if (!id) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && out[j + 1]!.supersetId === id) j++;
    if (j === i) out[i]!.supersetId = null;
    else if (used.has(id)) {
      // A second run sharing an id (a member was moved away and back elsewhere) becomes its own superset.
      const fresh = newId();
      for (let k = i; k <= j; k++) out[k]!.supersetId = fresh;
      used.add(fresh);
    } else used.add(id);
    i = j + 1;
  }
  return out;
}

/** The exercises in the same superset as `key`, in order (just that exercise when it isn't in one). */
export function supersetMembers(draft: Pick<WorkoutDraft, "exercises">, key: string): DraftExercise[] {
  const ex = draft.exercises.find((e) => e.id === key);
  if (!ex) return [];
  if (!ex.supersetId) return [ex];
  return draft.exercises.filter((e) => e.supersetId === ex.supersetId);
}

/**
 * The order a superset is performed in: round 1 of every member, then round 2, and so on. Members with
 * fewer sets drop out of the later rounds. Skipped members are left out.
 */
export function supersetRoundOrder(members: DraftExercise[]): { exerciseKey: string; setId: string; round: number }[] {
  const active = members.filter((m) => !m.skipped);
  const rounds = Math.max(0, ...active.map((m) => m.sets.length));
  const out: { exerciseKey: string; setId: string; round: number }[] = [];
  for (let r = 0; r < rounds; r++) for (const m of active) if (m.sets[r]) out.push({ exerciseKey: m.id, setId: m.sets[r]!.id, round: r });
  return out;
}

/**
 * The next set to do: the first exercise (or superset) with work left. Inside a superset this alternates —
 * A1, B1, A2, B2 — instead of finishing one exercise first.
 */
export function nextUp(draft: Pick<WorkoutDraft, "exercises">): { exerciseKey: string; setId: string | null } | null {
  for (const e of draft.exercises) {
    if (e.skipped) continue;
    if (e.sets.length === 0) return { exerciseKey: e.id, setId: null };
    if (e.supersetId) {
      const next = supersetRoundOrder(supersetMembers(draft, e.id)).find((x) => !draft.exercises.find((m) => m.id === x.exerciseKey)!.sets.find((s) => s.id === x.setId)!.completed);
      if (next) return { exerciseKey: next.exerciseKey, setId: next.setId };
      continue;
    }
    const set = e.sets.find((s) => !s.completed);
    if (set) return { exerciseKey: e.id, setId: set.id };
  }
  return null;
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
        distanceM: target?.distanceM ?? null,
      }));
      const ex: DraftExercise = {
        id: newId(),
        exerciseId: action.exercise.id,
        slug: action.exercise.slug,
        name: action.exercise.name,
        isTimed: action.exercise.isTimed,
        usesDistance: usesDistance(action.exercise.slug),
        supersetId: action.supersetId ?? null,
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
    case "linkSuperset": {
      // Join this exercise and the next one into a superset (or add the next one to this exercise's superset).
      const idx = state.exercises.findIndex((e) => e.id === action.exerciseKey);
      const next = state.exercises[idx + 1];
      if (idx < 0 || !next) return state;
      const id = state.exercises[idx]!.supersetId ?? next.supersetId ?? newId();
      const old = next.supersetId;
      return {
        ...state,
        exercises: state.exercises.map((e, i) => (i === idx || i === idx + 1 || (old && e.supersetId === old) ? { ...e, supersetId: id } : e)),
      };
    }
    case "unlinkSuperset":
      return mapExercise(state, action.exerciseKey, (e) => (e.supersetId ? { ...e, supersetId: null } : e));
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
        usesDistance: usesDistance(action.replacement.slug),
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
      let round = -1;
      const toggled = mapExercise(state, action.exerciseKey, (e) => {
        rest = e.restSeconds;
        return {
          ...e,
          sets: e.sets.map((s, i) => {
            if (s.id !== action.setId) return s;
            completedNow = !s.completed;
            round = i;
            return { ...s, completed: !s.completed };
          }),
        };
      });
      if (!completedNow || state.pausedAt) return toggled;
      const members = supersetMembers(toggled, action.exerciseKey).filter((m) => !m.skipped);
      if (members.length > 1) {
        // Superset: no rest between exercises — rest once the whole round is done, for the longest member rest.
        const roundDone = members.every((m) => !m.sets[round] || m.sets[round]!.completed);
        if (!roundDone) return { ...toggled, rest: { endsAt: null, durationSeconds: 0, pausedRemaining: null } };
        rest = Math.max(...members.map((m) => m.restSeconds));
      }
      if (rest > 0) return reduce(toggled, { type: "startRest", seconds: rest, now: action.now });
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
    distanceM: sanitizeNumber(s.distanceM ?? null, 0, 1000000),
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

/** Basic structural validation for restoring a draft from storage (current format only; see migrateDraft). */
export function isWorkoutDraft(value: unknown): value is WorkoutDraft {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<WorkoutDraft>;
  return (
    v.version === DRAFT_VERSION &&
    typeof v.clientId === "string" &&
    typeof v.name === "string" &&
    typeof v.startedAt === "string" &&
    Array.isArray(v.exercises) &&
    typeof v.rest === "object" &&
    v.rest !== null
  );
}

/**
 * Read a persisted draft of any known version and bring it up to the current format. Version 1 drafts
 * (saved before distance and supersets existed) gain `distanceM: null` on every set, `usesDistance` from the
 * exercise, no supersets and no template. Returns null for anything that isn't a draft.
 */
export function migrateDraft(value: unknown): WorkoutDraft | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown> & { version?: unknown };
  if (v.version === DRAFT_VERSION) return isWorkoutDraft(v) ? v : null;
  if (v.version !== 1) return null;
  const candidate = { ...v, version: DRAFT_VERSION } as Partial<WorkoutDraft>;
  if (!isWorkoutDraft(candidate)) return null;
  return {
    ...candidate,
    templateId: null,
    exercises: (candidate.exercises as unknown as Record<string, unknown>[]).map((e) => {
      const ex = e as unknown as DraftExercise;
      return {
        ...ex,
        usesDistance: typeof ex.usesDistance === "boolean" ? ex.usesDistance : usesDistance(String(ex.slug ?? "")),
        supersetId: null,
        sets: (Array.isArray(ex.sets) ? ex.sets : []).map((s) => ({ ...s, distanceM: s.distanceM ?? null })),
      };
    }),
  };
}

/** Pick whichever draft was modified most recently (local vs server). */
export function newerDraft(a: WorkoutDraft | null, b: WorkoutDraft | null): WorkoutDraft | null {
  if (!a) return b;
  if (!b) return a;
  if (a.clientId !== b.clientId) return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}
