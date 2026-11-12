import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockMessagesApi, type MockAnswer, type MockApi } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * How the coach behaves at the AI provider's edges (audit 2026-11-01, D3 and D4), against a local stand-in for the
 * Messages API: nothing reaches Anthropic.
 * - D3: a long reply is saved whole, as the member watched it stream (it was cut at 20,000 characters).
 * - D4: plan generation is sent once: the SDK's automatic retries could re-send (and re-bill) a slow or failed plan
 *   request until the route's time limit ended it mid-retry, with the reservation never given back.
 */
let answer: (body: { model: string; stream?: boolean }) => MockAnswer = () => ({ blocks: [{ type: "text", text: "ok" }] });
const api: MockApi = await startMockMessagesApi((body) => answer(body));
process.env.ANTHROPIC_BASE_URL = api.url;
const available = await stackAvailable();

describe.skipIf(!available)("AI coach at the provider's edges", () => {
  let pro: TestUser;
  const svc = serviceClient();
  const usageCount = async () => (await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", pro.id)).count ?? 0;

  beforeAll(async () => {
    pro = await createTestUser("coach-edges");
    await grantPlan(pro, "pro");
    await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString() }).eq("id", pro.id);
  });
  afterAll(async () => {
    await deleteTestUser(pro);
    await api.close();
  });

  it("D3: a reply longer than 20,000 characters is saved whole", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const long = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}: keep the bar path over mid-foot and brace before each rep.`).join("\n");
    expect(long.length).toBeGreaterThan(30_000);
    answer = () => ({ blocks: [{ type: "text", text: long }], usage: { output_tokens: 9000 } });
    const result = await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "Give me every squat cue you know, in detail.", mode: "chat" });
    expect(result.assistantMessage.content).toBe(long);
    const { data } = await svc.from("ai_messages").select("content").eq("id", result.assistantMessage.id).single();
    expect((data!.content as string).length).toBe(long.length);
  });

  it("D3: a reply too long even for the larger limit ends with the visible 'shortened' note, never a cut-off one", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    const huge = "Brace, breathe, drive. ".repeat(4000); // 92,000 characters
    answer = () => ({ blocks: [{ type: "text", text: huge }], usage: { output_tokens: 12000 } });
    const result = await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "More cues.", mode: "chat" });
    expect(result.assistantMessage.content.length).toBeLessThanOrEqual(60_000);
    expect(result.assistantMessage.content.endsWith("_(Response shortened — ask me to continue.)_")).toBe(true);
  });

  it("D4: a plan request the provider fails is sent once, reported as busy, and not charged", async () => {
    const { coachTurn, AiError } = await import("@/server/services/ai-coach");
    const before = api.requests.length;
    const counted = await usageCount();
    answer = () => ({ status: 529, errorType: "overloaded_error", message: "Overloaded" });
    const err = await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "Build me a 3-day strength plan.", mode: "plan" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as InstanceType<typeof AiError>).message).toMatch(/busy/i);
    // One attempt (it was three: the first plus two automatic retries).
    expect(api.requests.length - before).toBe(1);
    expect(await usageCount()).toBe(counted);
  });

  it("chat keeps the SDK's retries for a brief provider hiccup (the stream hasn't started, nothing is lost)", async () => {
    const { coachTurn } = await import("@/server/services/ai-coach");
    let calls = 0;
    answer = () => (++calls === 1 ? { status: 529, errorType: "overloaded_error" } : { blocks: [{ type: "text", text: "Back on track: 3 × 5 at RPE 7." }] });
    const result = await coachTurn({ supabase: pro.client, userId: pro.id, plan: "pro", conversationId: null, message: "Quick squat tip?", mode: "chat" });
    expect(result.assistantMessage.content).toContain("3 × 5");
    expect(calls).toBe(2);
  });
});
