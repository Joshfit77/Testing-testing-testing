import { describe, expect, it } from "vitest";
import { createDraft, draftFromOtherTab, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";

/**
 * Two tabs on the same workout. Reproduced in a browser on 2026-11-07: tab A logged set 1, tab B (opened after)
 * logged set 2, then a change in tab A wrote A's older draft over B's on the device and the server, and set 2 was
 * gone after a reload. The logger now switches to the other tab's copy when it is the same workout and newer.
 */
const NOW = "2026-11-07T10:00:00.000Z";
const later = (iso: string, s: number) => new Date(Date.parse(iso) + s * 1000).toISOString();
const ex = { id: "11111111-1111-4111-8111-111111111111", slug: "back-squat", name: "Back Squat", isTimed: false };

function started(): WorkoutDraft {
  return createDraft({ name: "Day 1", now: NOW, exercises: [{ exercise: ex, restSeconds: 90, target: { sets: 3, reps: "5" } }] });
}

function withSetDone(d: WorkoutDraft, index: number, now: string): WorkoutDraft {
  const e = d.exercises[0]!;
  const set = e.sets[index]!;
  const typed = workoutReducer(d, { type: "updateSet", exerciseKey: e.id, setId: set.id, patch: { weightKg: 100, reps: 5 } });
  return workoutReducer(typed, { type: "toggleSetComplete", exerciseKey: e.id, setId: set.id, now });
}

describe("a workout saved by another tab", () => {
  it("is adopted when it is the same workout and newer, so the other tab's sets are not written over", () => {
    const a = withSetDone(started(), 0, later(NOW, 10));
    const b = withSetDone(a, 1, later(NOW, 40));
    expect(b.exercises[0]!.sets.filter((s) => s.completed)).toHaveLength(2);
    expect(draftFromOtherTab(a, b)).toBe(b);
  });

  it("is ignored when it is older, the same copy, missing, or a different workout", () => {
    const a = withSetDone(started(), 0, later(NOW, 10));
    const stale = withSetDone(started(), 0, later(NOW, 5));
    expect(draftFromOtherTab(a, { ...stale, clientId: a.clientId })).toBeNull();
    expect(draftFromOtherTab(a, { ...a })).toBeNull();
    expect(draftFromOtherTab(a, null)).toBeNull();
    expect(draftFromOtherTab(null, a)).toBeNull();
    const other = withSetDone(started(), 0, later(NOW, 60)); // a different clientId
    expect(other.clientId).not.toBe(a.clientId);
    expect(draftFromOtherTab(a, other)).toBeNull();
  });
});
