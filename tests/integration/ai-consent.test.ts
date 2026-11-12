import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockMessagesApi, type MockAnswer, type MockApi } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * AI consent, end to end against the real database and a local stand-in for the AI provider (nothing reaches
 * Anthropic): no AI feature (coach chat and plans, the Bible helper, meal photos, label photos, and every other
 * request made through withAiRequest) sends anything to the provider until the member has agreed; withdrawing the
 * agreement stops the calls again; and prayer-journal text reaches the provider only for entries the member marked
 * share_with_coach. "Sent to the provider" is measured by the requests the stand-in received.
 */
let answer: () => MockAnswer = () => ({ blocks: [{ type: "text", text: "Keep going: three sets of five." }] });
const api: MockApi = await startMockMessagesApi(() => answer());
process.env.ANTHROPIC_BASE_URL = api.url;
const available = await stackAvailable();

describe.skipIf(!available)("AI consent gates every provider call", () => {
  const svc = serviceClient();
  let pro: TestUser;
  const usageCount = async () => (await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", pro.id)).count ?? 0;
  const setConsent = async (fields: { ai_data_consent_at?: string | null; food_photo_consent_at?: string | null }) => {
    // The member's own session, as the consent switches on the AI Coach and photo screens do it.
    const { error } = await pro.client.from("profiles").update(fields).eq("id", pro.id);
    if (error) throw error;
  };
  const photo = { base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAG/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z", mediaType: "image/jpeg" as const };

  beforeAll(async () => {
    pro = await createTestUser("ai-consent");
    await grantPlan(pro, "pro");
    // Start with no consent of any kind.
    await svc.from("profiles").update({ ai_data_consent_at: null, food_photo_consent_at: null }).eq("id", pro.id);
  });
  afterAll(async () => {
    await deleteTestUser(pro);
    await api.close();
  });

  it("without AI consent: coach chat and plan generation are refused before the provider is called or usage is counted", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const before = api.requests.length;
    const usage = await usageCount();
    for (const mode of ["chat", "plan"] as const) {
      await expect(coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "How should I train this week?", mode })).rejects.toMatchObject({
        code: "consent_required",
      });
    }
    expect(api.requests.length).toBe(before);
    expect(await usageCount()).toBe(usage);
    // No conversation or message was stored for the refused turns either.
    expect((await svc.from("ai_messages").select("id").eq("user_id", pro.id)).data).toEqual([]);
  });

  it("without AI consent: requests made through withAiRequest (meal plans, food explanations, photos) never run", async () => {
    const { withAiRequest } = await import("@/server/services/ai-coach");
    let ran = 0;
    for (const kind of ["meal_plan", "food_explain", "food_photo"] as const) {
      await expect(
        withAiRequest({ supabase: pro.client, userId: pro.id, plan: "pro", kind }, async () => {
          ran++;
          return { value: null, inputTokens: 0, outputTokens: 0 };
        }),
      ).rejects.toMatchObject({ code: "consent_required" });
    }
    expect(ran).toBe(0);
  });

  it("meal and label photos need their own photo consent as well as AI consent; either one missing sends nothing", async () => {
    const { analyzeFoodPhoto } = await import("@/server/services/food-photo");
    const { readLabelPhoto } = await import("@/server/services/label-photo");
    const before = api.requests.length;
    // Neither consent.
    await expect(analyzeFoodPhoto(pro.client, pro.id, "pro", photo, "")).rejects.toMatchObject({ code: "consent_required" });
    await expect(readLabelPhoto(pro.client, pro.id, "pro", photo)).rejects.toMatchObject({ code: "consent_required" });
    // Photo consent only (general AI consent still off).
    await setConsent({ food_photo_consent_at: new Date().toISOString() });
    await expect(analyzeFoodPhoto(pro.client, pro.id, "pro", photo, "")).rejects.toMatchObject({ code: "consent_required" });
    await expect(readLabelPhoto(pro.client, pro.id, "pro", photo)).rejects.toMatchObject({ code: "consent_required" });
    // AI consent only (photo consent withdrawn).
    await setConsent({ ai_data_consent_at: new Date().toISOString(), food_photo_consent_at: null });
    await expect(analyzeFoodPhoto(pro.client, pro.id, "pro", photo, "")).rejects.toMatchObject({ code: "consent_required" });
    await expect(readLabelPhoto(pro.client, pro.id, "pro", photo)).rejects.toMatchObject({ code: "consent_required" });
    expect(api.requests.length).toBe(before);
    await setConsent({ ai_data_consent_at: null });
  });

  it("the Bible helper sends nothing without consent, answers with it, and stops again when consent is withdrawn", async () => {
    const { askBible } = await import("@/server/services/bible-ai");
    answer = () => ({ blocks: [{ type: "text", text: "John 3:16 speaks of God's love for the world." }] });
    const thread = crypto.randomUUID();
    const before = api.requests.length;
    expect(await askBible(pro.id, "pro", "What does John 3:16 mean?", thread)).toMatchObject({ ok: false, code: "consent_required" });
    expect(api.requests.length).toBe(before);

    await setConsent({ ai_data_consent_at: new Date().toISOString() });
    expect(await askBible(pro.id, "pro", "What does John 3:16 mean?", thread)).toMatchObject({ ok: true });
    expect(api.requests.length).toBe(before + 1);

    await setConsent({ ai_data_consent_at: null });
    expect(await askBible(pro.id, "pro", "And John 3:17?", thread)).toMatchObject({ ok: false, code: "consent_required" });
    expect(api.requests.length).toBe(before + 1);
  });

  it("prayer journal text reaches the provider only for entries shared with the coach; withdrawal stops the coach", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const sharedMarker = `SHARED-${crypto.randomUUID().slice(0, 8)}`;
    const privateMarker = `PRIVATE-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await svc.from("faith_journal_entries").insert([
      { user_id: pro.id, body: `Grateful for strength today ${sharedMarker}`, share_with_coach: true },
      { user_id: pro.id, body: `A private prayer ${privateMarker}`, share_with_coach: false },
      { user_id: pro.id, body: `Another private prayer ${privateMarker}`, share_with_coach: false },
    ]);
    if (error) throw error;

    answer = () => ({ blocks: [{ type: "text", text: "Keep going: three sets of five." }] });
    await setConsent({ ai_data_consent_at: new Date().toISOString() });
    const before = api.requests.length;
    const result = await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "How should I train this week?", mode: "chat" });
    expect(result.assistantMessage.content).toContain("three sets of five");
    const sent = api.requests.slice(before);
    expect(sent.length).toBeGreaterThan(0);
    const everything = JSON.stringify(sent);
    expect(everything).toContain(sharedMarker);
    expect(everything).not.toContain(privateMarker);

    // Withdrawal: the next message is refused and nothing more is sent.
    await setConsent({ ai_data_consent_at: null });
    const afterAllowed = api.requests.length;
    await expect(
      coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: result.conversationId, message: "One more question.", mode: "chat" }),
    ).rejects.toMatchObject({ code: "consent_required" });
    expect(api.requests.length).toBe(afterAllowed);
  });
});
