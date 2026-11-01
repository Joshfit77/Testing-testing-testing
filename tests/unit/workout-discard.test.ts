import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft, draftSnapshot, finishFailureMessage, restorableDraft, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { draftSnapshotSchema } from "@/lib/validation/schemas";
import { discardedWorkoutIds, pendingDiscards, rememberDiscard, retryPendingDiscards } from "@/lib/workout-storage";

/**
 * Audit regression (docs/audit/3-workouts-nutrition-progress-faith.md, W1): a workout discarded while offline used to
 * come back on the next visit, because only the device copy was cleared and the server's in-progress snapshot was
 * restored by the logger. The device now remembers the discard, never restores that workout, and deletes the
 * server copy once it's online.
 */
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function draft(clientId: string, updatedAt: string): WorkoutDraft {
  return { ...createDraft({ name: "Push day", now: "2026-10-31T09:00:00.000Z", clientId }), updatedAt };
}

beforeEach(() => localStorage.clear());

describe("restoring a workout after a discard", () => {
  it("never restores a server snapshot of a workout discarded on this device", () => {
    const server = draft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-31T09:30:00.000Z");
    expect(restorableDraft(null, server, new Set())).toBe(server);
    expect(restorableDraft(null, server, new Set([server.clientId]))).toBeNull();
  });

  it("still restores the newest workout that wasn't discarded", () => {
    const discarded = draft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-31T10:00:00.000Z");
    const kept = draft("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-10-31T09:00:00.000Z");
    expect(restorableDraft(kept, discarded, new Set([discarded.clientId]))).toBe(kept);
    expect(restorableDraft(kept, discarded, new Set())).toBe(discarded);
  });
});

describe("the in-progress backup sent to the server", () => {
  it("is accepted by the server's schema even when the workout is renamed to spaces (W2)", () => {
    const d = workoutReducer(draft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-10-31T09:30:00.000Z"), { type: "rename", name: "   " });
    // What the logger used to send: `d.name || "Workout"` keeps "   ", which the server rejects.
    expect(draftSnapshotSchema.safeParse({ ...draftSnapshot(d), name: d.name || "Workout" }).success).toBe(false);
    const snap = draftSnapshot(d);
    expect(snap.name).toBe("Workout");
    expect(draftSnapshotSchema.safeParse(snap).success).toBe(true);
    expect(draftSnapshot({ ...d, name: "  Leg day " }).name).toBe("Leg day");
  });
});

describe("when finishing can't reach the server (W5)", () => {
  it("tells an online member their session may have ended, instead of calling them offline", () => {
    // Online, the request fails because an ended session is redirected to sign-in; "offline" sent members round in circles.
    expect(finishFailureMessage(true)).toMatch(/sign in again/);
    expect(finishFailureMessage(true)).not.toMatch(/offline/i);
    expect(finishFailureMessage(true)).toMatch(/kept on this device/);
    expect(finishFailureMessage(false)).toMatch(/offline/);
    expect(finishFailureMessage(false)).toMatch(/saved on this device/);
  });
});

describe("pending discards on this device", () => {
  it("are kept per account, without duplicates; one deleted on the server isn't retried", () => {
    rememberDiscard(USER, "a");
    rememberDiscard(USER, "b", true); // discarded online: the server copy is already gone
    rememberDiscard(USER, "a");
    expect(discardedWorkoutIds(USER)).toEqual(["b", "a"]);
    expect(pendingDiscards(USER)).toEqual(["a"]);
    expect(discardedWorkoutIds(OTHER)).toEqual([]);
  });

  it("keep only the 20 most recent and survive corrupt storage", () => {
    for (let i = 0; i < 25; i++) rememberDiscard(USER, `id-${i}`);
    expect(discardedWorkoutIds(USER)).toHaveLength(20);
    expect(discardedWorkoutIds(USER)[0]).toBe("id-5");
    localStorage.setItem(`ngf.workout.discarded.${USER}`, "{not json");
    expect(discardedWorkoutIds(USER)).toEqual([]);
    localStorage.setItem(`ngf.workout.discarded.${USER}`, JSON.stringify([{ id: "ok" }, "x", 3, null, { id: 4 }]));
    expect(discardedWorkoutIds(USER)).toEqual(["ok"]);
  });

  it("are deleted on the server once online, stay pending while it can't be reached, and are still never restored", async () => {
    rememberDiscard(USER, "a");
    rememberDiscard(USER, "b");
    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await retryPendingDiscards(USER, offline)).toBe(0);
    expect(pendingDiscards(USER)).toEqual(["a", "b"]);

    const server = vi.fn(async (id: string) => ({ ok: id === "a" }));
    expect(await retryPendingDiscards(USER, server)).toBe(1);
    expect(server).toHaveBeenCalledWith("a");
    expect(server).toHaveBeenCalledWith("b");
    expect(pendingDiscards(USER)).toEqual(["b"]);
    // A page that loaded the server snapshot before the delete landed still mustn't restore it.
    expect(discardedWorkoutIds(USER)).toEqual(["a", "b"]);
    const stale = draft("a", "2026-10-31T09:30:00.000Z");
    expect(restorableDraft(null, stale, new Set(discardedWorkoutIds(USER)))).toBeNull();
  });
});
