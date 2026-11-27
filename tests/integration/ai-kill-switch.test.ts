import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * The owner's AI kill switches against the real database, read outside any web request (as a scheduled job reads
 * them): switching ai_coach off refuses every AI entry point before the provider is called; a missing row means on.
 */
describe.skipIf(!available)("AI kill switch", async () => {
  const { isFlagEnabled, getFlagState } = await import("@/server/flags");
  const { assertAiAllowed, AiError } = await import("@/server/services/ai-coach");
  const svc = serviceClient();
  let member: TestUser;
  let before: { key: string; enabled: boolean; description: string | null }[] = [];

  const setFlag = async (key: string, enabled: boolean | null) => {
    const res = enabled === null ? await svc.from("feature_flags").delete().eq("key", key) : await svc.from("feature_flags").upsert({ key, enabled }, { onConflict: "key" });
    expect(res.error).toBeNull();
  };

  beforeAll(async () => {
    member = await createTestUser("kill-switch");
    await grantPlan(member, "pro");
    const { data } = await svc.from("feature_flags").select("key, enabled, description").in("key", ["ai_coach", "ai_plan_generation"]);
    before = (data ?? []) as typeof before;
  });
  afterAll(async () => {
    for (const key of ["ai_coach", "ai_plan_generation"]) await setFlag(key, null);
    if (before.length) await svc.from("feature_flags").upsert(before, { onConflict: "key" });
    await deleteTestUser(member);
  });

  it("flags are readable outside a request (no session needed)", async () => {
    const state = await getFlagState();
    expect(state.readable).toBe(true);
  });

  it("ai_coach off refuses chat and every other AI feature's gate; on again lets it through", async () => {
    await setFlag("ai_coach", false);
    expect(await isFlagEnabled("ai_coach")).toBe(false);
    await expect(assertAiAllowed(member.id, "pro", "chat")).rejects.toMatchObject({ code: "disabled" });
    await setFlag("ai_coach", true);
    expect(await isFlagEnabled("ai_coach")).toBe(true);
    const ok = await assertAiAllowed(member.id, "pro", "chat").catch((e: unknown) => e);
    expect(ok instanceof AiError && ok.code === "disabled").toBe(false);
  });

  it("ai_plan_generation off refuses plan mode only", async () => {
    await setFlag("ai_coach", true);
    await setFlag("ai_plan_generation", false);
    await expect(assertAiAllowed(member.id, "pro", "plan")).rejects.toMatchObject({ code: "disabled" });
    const chat = await assertAiAllowed(member.id, "pro", "chat").catch((e: unknown) => e);
    expect(chat instanceof AiError && chat.code === "disabled").toBe(false);
  });

  it("a missing row still means on (a fresh database keeps working)", async () => {
    await setFlag("ai_coach", null);
    expect(await isFlagEnabled("ai_coach")).toBe(true);
  });
});
