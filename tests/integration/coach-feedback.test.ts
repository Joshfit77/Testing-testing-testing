import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * TestFlight feedback on coach replies (migration 050): collected only after the owner switches the `coach_feedback`
 * flag on, only on the member's own coach replies, readable only by them, and part of their account data.
 */
let signedIn: SupabaseClient;
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => signedIn }));

const available = await stackAvailable();

describe.skipIf(!available)("coach reply feedback", () => {
  let member: TestUser;
  let other: TestUser;
  let reply: string;
  let question: string;
  let othersReply: string;
  const svc = serviceClient();
  const setFlag = (enabled: boolean) => svc.from("feature_flags").upsert({ key: "coach_feedback", enabled }, { onConflict: "key" });

  async function conversation(u: TestUser) {
    const { data: c } = await svc.from("ai_conversations").insert({ user_id: u.id, title: "Feedback test" }).select("id").single();
    const { data: rows } = await svc
      .from("ai_messages")
      .insert([
        { conversation_id: c!.id, user_id: u.id, role: "user", content: "How do I brace?" },
        { conversation_id: c!.id, user_id: u.id, role: "assistant", content: "Big breath into your belly, then brace." },
      ])
      .select("id, role");
    return { question: rows!.find((r) => r.role === "user")!.id as string, reply: rows!.find((r) => r.role === "assistant")!.id as string };
  }

  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("feedback-member"), createTestUser("feedback-other")]);
    await Promise.all([grantPlan(member, "pro"), grantPlan(other, "pro")]);
    ({ reply, question } = await conversation(member));
    othersReply = (await conversation(other)).reply;
    signedIn = member.client;
  });
  afterAll(async () => {
    await setFlag(false);
    await Promise.all([deleteTestUser(member), deleteTestUser(other)]);
  });

  it("ships switched off: the flag exists and is off, and nothing is stored", async () => {
    const { data: flag } = await svc.from("feature_flags").select("enabled").eq("key", "coach_feedback").single();
    expect(flag!.enabled).toBe(false);
    const { submitCoachFeedbackAction } = await import("@/server/actions/coach-feedback");
    expect(await submitCoachFeedbackAction({ messageId: reply, rating: "yes" })).toEqual({ ok: false, error: "Feedback isn't being collected right now." });
    expect((await svc.from("ai_message_feedback").select("id").eq("user_id", member.id)).data).toEqual([]);
    // A deployment without the flag row at all is off too (missing flags otherwise default to on).
    await svc.from("feature_flags").delete().eq("key", "coach_feedback");
    expect((await submitCoachFeedbackAction({ messageId: reply, rating: "yes" })).ok).toBe(false);
    await setFlag(false);
  });

  it("once switched on: a rating, then a comment, then a safety report on the same reply", async () => {
    await setFlag(true);
    const { submitCoachFeedbackAction } = await import("@/server/actions/coach-feedback");
    expect(await submitCoachFeedbackAction({ messageId: reply, rating: "partially" })).toEqual({ ok: true });
    expect(await submitCoachFeedbackAction({ messageId: reply, rating: "partially", comment: "Good cue, but no rep scheme." })).toEqual({ ok: true });
    expect(await submitCoachFeedbackAction({ messageId: reply, rating: null, safetyConcern: true, comment: "It ignored my back pain." })).toEqual({ ok: true });
    const { data } = await svc.from("ai_message_feedback").select("rating, comment, safety_concern").eq("user_id", member.id);
    expect(data).toEqual([{ rating: "partially", comment: "It ignored my back pain.", safety_concern: true }]);
  });

  it("only on the member's own coach replies: not their own question, not another member's reply", async () => {
    await setFlag(true);
    const { submitCoachFeedbackAction } = await import("@/server/actions/coach-feedback");
    expect((await submitCoachFeedbackAction({ messageId: question, rating: "yes" })).ok).toBe(false);
    expect((await submitCoachFeedbackAction({ messageId: othersReply, rating: "no" })).ok).toBe(false);
    // Directly against the database too.
    expect((await member.client.from("ai_message_feedback").insert({ user_id: member.id, message_id: othersReply, rating: "no" })).error).not.toBeNull();
    expect((await member.client.from("ai_message_feedback").insert({ user_id: other.id, message_id: othersReply, rating: "no" })).error).not.toBeNull();
    expect((await svc.from("ai_message_feedback").select("id").eq("message_id", othersReply)).data).toEqual([]);
  });

  it("members see only their own feedback, and it is part of their account (export, deletion)", async () => {
    await setFlag(true);
    signedIn = other.client;
    const { submitCoachFeedbackAction } = await import("@/server/actions/coach-feedback");
    expect((await submitCoachFeedbackAction({ messageId: othersReply, rating: "yes" })).ok).toBe(true);
    signedIn = member.client;
    const mine = await member.client.from("ai_message_feedback").select("message_id");
    expect(mine.data!.map((r) => r.message_id)).toEqual([reply]);
    const { USER_TABLES } = await import("@/server/services/account");
    expect(USER_TABLES).toContainEqual({ table: "ai_message_feedback", column: "user_id" });
  });
});
