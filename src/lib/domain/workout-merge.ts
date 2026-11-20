import type { DraftExercise, DraftSet, WorkoutDraft } from "@/lib/domain/workout-draft";
import type { FinishWorkoutInput } from "@/lib/validation/schemas";

/**
 * Combining two copies of the same workout (findings F-29 and F-30, security assessment 2026-11-20).
 *
 * Two devices or tabs can change one workout at the same time. Neither copy may simply replace the other: the server
 * refuses a backup built on an older revision and hands back its copy, and the device combines them here. The rules,
 * in order of importance:
 *   1. A set completed on either side stays completed (with the values of the side that completed it).
 *   2. A set or exercise that exists on only one side is kept, in its place.
 *   3. Where both sides have the same set in the same state, the copy changed most recently wins.
 * Deleting a set on one device while the other still has it brings it back: losing a completed set is worse than
 * seeing a removed one again.
 */

export interface DraftMerge {
  draft: WorkoutDraft;
  /** Completed sets the result has that `mine` didn't (they came from the other copy). */
  fromOther: number;
  /** The result differs from `mine` in anything but its timestamp. */
  changed: boolean;
}

const isNewer = (a: { updatedAt: string }, b: { updatedAt: string }) => Date.parse(a.updatedAt) > Date.parse(b.updatedAt);

/** Items of `mine` in order, with each item only in `theirs` placed after the item it follows there. */
function mergeOrdered<T extends { id: string }>(mine: T[], theirs: T[], combine: (m: T, t: T) => T): T[] {
  const theirsById = new Map(theirs.map((t) => [t.id, t]));
  const out = mine.map((m) => {
    const t = theirsById.get(m.id);
    return t ? combine(m, t) : m;
  });
  const have = new Set(out.map((x) => x.id));
  theirs.forEach((t, i) => {
    if (have.has(t.id)) return;
    // After the nearest earlier item of theirs that is already placed; at the start if there is none.
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.findIndex((x) => x.id === theirs[j]!.id);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    out.splice(at, 0, t);
    have.add(t.id);
  });
  return out;
}

function mergeSet(mine: DraftSet, theirs: DraftSet, theirsNewer: boolean): DraftSet {
  if (mine.completed !== theirs.completed) return mine.completed ? mine : theirs;
  return theirsNewer ? theirs : mine;
}

function mergeExercise(mine: DraftExercise, theirs: DraftExercise, theirsNewer: boolean): DraftExercise {
  const base = theirsNewer ? theirs : mine;
  return { ...base, sets: mergeOrdered(mine.sets, theirs.sets, (m, t) => mergeSet(m, t, theirsNewer)) };
}

const completedIds = (d: WorkoutDraft) => new Set(d.exercises.flatMap((e) => e.sets.filter((s) => s.completed).map((s) => `${e.id}/${s.id}`)));
const withoutTime = (d: WorkoutDraft) => JSON.stringify({ ...d, updatedAt: "" });

/**
 * Combine this device's copy (`mine`) with another copy of the same workout (`theirs`, from the server or another
 * tab). `now` becomes the result's updatedAt (kept later than both, so every copy recognises it as the newest).
 */
export function mergeDrafts(mine: WorkoutDraft, theirs: WorkoutDraft, now: string): DraftMerge {
  if (mine.clientId !== theirs.clientId) throw new Error("mergeDrafts: different workouts");
  const theirsNewer = isNewer(theirs, mine);
  const latest = Math.max(Date.parse(mine.updatedAt), Date.parse(theirs.updatedAt));
  const updatedAt = Date.parse(now) > latest ? now : new Date(latest + 1).toISOString();
  const draft: WorkoutDraft = {
    ...mine,
    name: theirsNewer ? theirs.name : mine.name,
    notes: theirsNewer ? theirs.notes : mine.notes,
    startedAt: Date.parse(theirs.startedAt) < Date.parse(mine.startedAt) ? theirs.startedAt : mine.startedAt,
    pausedAt: theirsNewer ? theirs.pausedAt : mine.pausedAt,
    pausedSeconds: theirsNewer ? theirs.pausedSeconds : mine.pausedSeconds,
    userProgramId: mine.userProgramId ?? theirs.userProgramId,
    programDayId: mine.programDayId ?? theirs.programDayId,
    templateId: mine.templateId ?? theirs.templateId,
    // Only present when either copy has it, so identical copies stay identical.
    ...(mine.finishRequestedAt || theirs.finishRequestedAt ? { finishRequestedAt: mine.finishRequestedAt ?? theirs.finishRequestedAt } : {}),
    exercises: mergeOrdered(mine.exercises, theirs.exercises, (m, t) => mergeExercise(m, t, theirsNewer)),
    updatedAt,
  };
  const before = completedIds(mine);
  const fromOther = [...completedIds(draft)].filter((k) => !before.has(k)).length;
  return { draft, fromOther, changed: withoutTime(draft) !== withoutTime(mine) };
}

type FinishedExercise = FinishWorkoutInput["exercises"][number];

/**
 * A workout already saved as finished (by another device, or by this one before its reply was lost), and another
 * finished copy of it arriving. Saved sets carry no ids, so exercises are matched by exercise (in order) and sets by
 * position. A set completed in either copy is kept completed; the saved copy wins where both completed it; extra sets
 * and exercises are added. `added` counts the completed sets the result gains, 0 when the saved workout already has
 * everything (then nothing should be written).
 */
export function mergeFinishedExercises(saved: FinishedExercise[], incoming: FinishedExercise[]): { exercises: FinishedExercise[]; added: number } {
  const out = saved.map((e) => ({ ...e, sets: [...e.sets] }));
  const used = new Set<number>();
  let added = 0;
  incoming.forEach((inc, i) => {
    // The same exercise at the same place, else its first unmatched occurrence.
    const at = out[i] && !used.has(i) && out[i]!.exerciseId === inc.exerciseId ? i : out.findIndex((e, k) => !used.has(k) && e.exerciseId === inc.exerciseId);
    if (at < 0) {
      out.push({ ...inc, sets: [...inc.sets] });
      used.add(out.length - 1);
      added += inc.skipped ? 0 : inc.sets.filter((s) => s.completed).length;
      return;
    }
    used.add(at);
    const target = out[at]!;
    inc.sets.forEach((s, k) => {
      const have = target.sets[k];
      if (!have) {
        target.sets.push(s);
        if (s.completed && !target.skipped) added++;
      } else if (!have.completed && s.completed) {
        target.sets[k] = s;
        if (!target.skipped) added++;
      }
    });
    // A skipped exercise that the other copy actually did is no longer skipped.
    if (target.skipped && !inc.skipped && inc.sets.some((s) => s.completed)) {
      target.skipped = false;
      target.skipReason = null;
      added += target.sets.filter((s) => s.completed).length;
    }
  });
  return { exercises: out, added };
}

/**
 * The unfinished workouts to offer when the logger opens (F-29): this device's copy and every unfinished workout on the
 * account (each server copy carries its revision in `baseRev`). Copies of the same workout become one: when the device
 * copy was built on the account's current revision it is simply newer (kept as it is, so a set removed on this device
 * stays removed); otherwise the account changed elsewhere and the two are combined on the account's revision. Copies
 * from before revisions (no `baseRev` on the server copy) fall back to the newer of the two. Different workouts are all
 * returned, this device's first, then the account's most recently changed: none is dropped.
 */
export function restoreCandidates(local: WorkoutDraft | null, server: WorkoutDraft[], now: string): WorkoutDraft[] {
  const out: WorkoutDraft[] = [];
  let mine = local;
  for (const s of server) {
    if (mine && s.clientId === mine.clientId) {
      if (s.baseRev === undefined || s.baseRev === null) mine = isNewer(s, mine) ? s : mine;
      else if (mine.baseRev === s.baseRev) mine = { ...mine };
      else mine = { ...mergeDrafts(mine, s, now).draft, baseRev: s.baseRev };
      continue;
    }
    if (!out.some((o) => o.clientId === s.clientId)) out.push(s);
  }
  return mine ? [mine, ...out] : out;
}
