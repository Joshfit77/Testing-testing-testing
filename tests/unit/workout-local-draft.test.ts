import { beforeEach, describe, expect, it } from "vitest";
import { createDraft, restorableDraft, workoutReducer, type WorkoutDraft } from "@/lib/domain/workout-draft";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "@/lib/workout-storage";

/**
 * The in-progress workout survives a reload or an app restart: the device copy (localStorage) is read back exactly,
 * per member, and when both a device copy and a server snapshot exist the newer one is restored.
 */
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function draft(clientId: string, updatedAt: string): WorkoutDraft {
  return { ...createDraft({ name: "Push day", now: "2026-11-12T09:00:00.000Z", clientId }), updatedAt };
}

beforeEach(() => localStorage.clear());

describe("workout draft on the device", () => {
  it("is read back after a reload exactly as saved, including progress made", () => {
    const d = workoutReducer(draft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-11-12T09:10:00.000Z"), { type: "pause", now: "2026-11-12T09:20:00.000Z" });
    expect(saveLocalDraft(USER, d)).toBe(true);
    // A reload: nothing in memory, only storage.
    expect(loadLocalDraft(USER)).toEqual(d);
  });

  it("belongs to one member: another account on the same device never sees it", () => {
    saveLocalDraft(USER, draft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-11-12T09:10:00.000Z"));
    expect(loadLocalDraft(OTHER)).toBeNull();
  });

  it("is gone once cleared (after a successful finish), and a corrupt copy reads as none", () => {
    saveLocalDraft(USER, draft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-11-12T09:10:00.000Z"));
    clearLocalDraft(USER);
    expect(loadLocalDraft(USER)).toBeNull();
    localStorage.setItem(`ngf.workout.draft.${USER}`, "{not json");
    expect(loadLocalDraft(USER)).toBeNull();
  });

  it("restoring prefers the newer of the device copy and the server snapshot (another device may have logged more)", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const local = draft(id, "2026-11-12T09:10:00.000Z");
    const server = draft(id, "2026-11-12T09:30:00.000Z");
    expect(restorableDraft(local, server, new Set())).toBe(server);
    expect(restorableDraft({ ...local, updatedAt: "2026-11-12T09:40:00.000Z" }, server, new Set())?.updatedAt).toBe("2026-11-12T09:40:00.000Z");
    // Offline restart with no server copy: the device copy is restored.
    expect(restorableDraft(local, null, new Set())).toBe(local);
  });
});
