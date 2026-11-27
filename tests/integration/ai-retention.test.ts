import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * AI conversation retention (AI_CHAT_RETENTION_DAYS), against the real database: with retention set, the job deletes
 * coach and Bible-helper messages older than the period and coach conversations inactive since then, and keeps
 * everything newer; with retention off it deletes nothing. The scheduled route only runs for the cron secret.
 * Rows are back-dated to more than a year ago, with a 365-day period, so rows other suites create today are never in
 * range (the job deletes across all members, exactly as it does in production).
 */
describe.skipIf(!available)("AI conversation retention", async () => {
  const { purgeExpiredAiChats } = await import("@/server/services/ai-retention");
  const admin = serviceClient();
  let member: TestUser;
  let other: TestUser;
  const day = 86_400_000;
  const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

  /** A conversation last active `activeDaysAgo` days ago (set on insert: an update would reset updated_at to now). */
  async function conversation(user: TestUser, activeDaysAgo: number) {
    const at = ago(activeDaysAgo);
    const { data, error } = await admin.from("ai_conversations").insert({ user_id: user.id, title: "Retention test", created_at: at, updated_at: at }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }
  async function message(user: TestUser, conversationId: string, createdDaysAgo: number, content: string) {
    const { data, error } = await admin
      .from("ai_messages")
      .insert({ conversation_id: conversationId, user_id: user.id, role: "user", content, created_at: ago(createdDaysAgo) })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
  const exists = async (table: string, id: string) => Boolean((await admin.from(table).select("id").eq("id", id).maybeSingle()).data);

  beforeAll(async () => {
    [member, other] = await Promise.all([createTestUser("retention-a"), createTestUser("retention-b")]);
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(member), deleteTestUser(other)]);
  });

  it("does nothing while retention is off", async () => {
    const conv = await conversation(member, 400);
    const old = await message(member, conv, 400, "an old question");
    expect(await purgeExpiredAiChats({ days: null })).toEqual({ enabled: false });
    expect(await exists("ai_messages", old)).toBe(true);
    expect(await exists("ai_conversations", conv)).toBe(true);
  });

  it("deletes what is past the period and keeps what is newer, for every member", async () => {
    // An active conversation: its old message goes, its recent one stays, and so does the conversation.
    const active = await conversation(member, 10);
    const activeOld = await message(member, active, 400, "old message in an active conversation");
    const activeNew = await message(member, active, 10, "recent message");
    // An inactive conversation of another member: it goes, with its messages and the feedback on them.
    const stale = await conversation(other, 380);
    const staleMsg = await message(other, stale, 380, "message in a stale conversation");
    const fb = await admin.from("ai_message_feedback").insert({ user_id: other.id, message_id: staleMsg, rating: "yes" }).select("id").single();
    expect(fb.error).toBeNull();
    const thread = crypto.randomUUID();
    const bibleOld = await admin.from("bible_ai_messages").insert({ user_id: member.id, thread_id: thread, role: "user", content: "old Bible question", created_at: ago(400) }).select("id").single();
    const bibleNew = await admin.from("bible_ai_messages").insert({ user_id: member.id, thread_id: thread, role: "user", content: "recent Bible question", created_at: ago(5) }).select("id").single();
    expect(bibleOld.error).toBeNull();
    expect(bibleNew.error).toBeNull();

    const report = await purgeExpiredAiChats({ days: 365 });
    expect(report.enabled).toBe(true);
    if (!report.enabled) return;
    expect(report.days).toBe(365);
    expect(report.coachMessages).toBeGreaterThanOrEqual(2);
    expect(report.coachConversations).toBeGreaterThanOrEqual(1);
    expect(report.bibleMessages).toBeGreaterThanOrEqual(1);

    expect(await exists("ai_messages", activeOld)).toBe(false);
    expect(await exists("ai_messages", activeNew)).toBe(true);
    expect(await exists("ai_conversations", active)).toBe(true);
    expect(await exists("ai_conversations", stale)).toBe(false);
    expect(await exists("ai_messages", staleMsg)).toBe(false);
    expect(await exists("ai_message_feedback", fb.data!.id)).toBe(false);
    expect(await exists("bible_ai_messages", bibleOld.data!.id)).toBe(false);
    expect(await exists("bible_ai_messages", bibleNew.data!.id)).toBe(true);
  });

  it("the scheduled route refuses callers without the cron secret", async () => {
    const { GET } = await import("@/app/api/maintenance/ai-retention/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/maintenance/ai-retention", { headers: { authorization: "Bearer wrong-secret-value-123" } }));
    expect(res.status).toBe(401);
    const none = await GET(new NextRequest("http://localhost/api/maintenance/ai-retention"));
    expect(none.status).toBe(401);
  });
});
