import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";
import { createDraft, draftSnapshot, finishPayload, SIGNED_OUT_WORKOUT_MESSAGE } from "@/lib/domain/workout-draft";

/**
 * The sign-in running out mid-workout (review 2026-11-20). The backup and Finish used to call requireUser, whose
 * redirect sent the whole app to the login page in the middle of a set. They now answer "signed out" without
 * redirecting and without writing anything, so the logger keeps the workout on screen and on the device and tells the
 * member; once signed in again the same copy saves normally.
 */
const available = await stackAvailable();
let current: SupabaseClient = anonClient();
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

describe.skipIf(!available)("workout backup and Finish when the sign-in has run out", () => {
  const svc = serviceClient();
  let member: TestUser;
  const draft = createDraft({ name: "Expired session day", now: new Date().toISOString(), clientId: crypto.randomUUID() });

  beforeAll(async () => {
    member = await createTestUser("signed-out");
  });
  afterAll(async () => {
    await svc.from("workout_sessions").delete().eq("user_id", member.id);
    await deleteTestUser(member);
  });

  it("answers 'signed out' (no redirect, nothing written) to the backup and to Finish", async () => {
    const { syncWorkoutDraftAction, finishWorkoutAction } = await import("@/server/actions/workouts");
    current = anonClient();
    await expect(syncWorkoutDraftAction(draftSnapshot(draft))).resolves.toEqual({ ok: false, error: SIGNED_OUT_WORKOUT_MESSAGE });
    await expect(finishWorkoutAction(finishPayload(draft, new Date().toISOString()))).resolves.toEqual({ ok: false, error: SIGNED_OUT_WORKOUT_MESSAGE });
    const { count } = await svc.from("workout_sessions").select("id", { count: "exact", head: true }).eq("client_id", draft.clientId);
    expect(count).toBe(0);
  });

  it("signed in again, the same copy is backed up to the member's account", async () => {
    const { syncWorkoutDraftAction } = await import("@/server/actions/workouts");
    current = member.client;
    await expect(syncWorkoutDraftAction(draftSnapshot(draft))).resolves.toMatchObject({ ok: true });
    const { data } = await svc.from("workout_sessions").select("user_id, status").eq("client_id", draft.clientId).single();
    expect(data).toEqual({ user_id: member.id, status: "in_progress" });
  });
});
