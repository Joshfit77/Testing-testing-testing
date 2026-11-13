import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/** Coaching memories are sealed at rest, readable only for their owner through the server, and exported readable. */
describe.skipIf(!available)("coaching memory sealing", async () => {
  const { sealMemory, openMemories } = await import("@/server/crypto/memory-crypto");
  const { loadAthleteSnapshot } = await import("@/server/coach/snapshot");
  const { exportUserData } = await import("@/server/services/account");
  const svc = serviceClient();
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    [alice, bob] = await Promise.all([createTestUser("seal-alice"), createTestUser("seal-bob")]);
    await grantPlan(alice, "pro");
    await svc.from("profiles").update({ coach_memory_enabled: true, coach_memory_consent_at: new Date().toISOString(), ai_data_consent_at: new Date().toISOString() }).eq("id", alice.id);
  });
  afterAll(async () => Promise.all([deleteTestUser(alice), deleteTestUser(bob)]));

  it("stores only sealed text, and the coach reads it back for the owner", async () => {
    const { error } = await alice.client.from("coach_memories").insert({ user_id: alice.id, category: "exercise_preferences", content: sealMemory("Loves front squats, hates lunges", alice.id), source: "member" });
    expect(error).toBeNull();
    const { data: raw } = await svc.from("coach_memories").select("content").eq("user_id", alice.id).single();
    expect(raw!.content).toMatch(/^enc:v1:/);
    expect(raw!.content).not.toContain("squat");
    const snap = await loadAthleteSnapshot(alice.client, alice.id);
    expect(snap.memory?.items.map((m) => m.content)).toEqual(["Loves front squats, hates lunges"]);
    const exported = await exportUserData(alice.client, alice.id, undefined);
    expect((exported.coach_memories as { content: string }[]).map((m) => m.content)).toEqual(["Loves front squats, hates lunges"]);
  });

  it("a sealed row copied to another account can't be opened there", async () => {
    const { data: raw } = await svc.from("coach_memories").select("content").eq("user_id", alice.id).single();
    expect(openMemories([{ content: raw!.content as string }], bob.id)).toEqual([]);
  });

  it("plain text keeps its 300-character limit; sealed text has its own bound", async () => {
    expect((await alice.client.from("coach_memories").insert({ user_id: alice.id, category: "other", content: "x".repeat(301), source: "member" })).error).not.toBeNull();
    expect((await alice.client.from("coach_memories").insert({ user_id: alice.id, category: "other", content: `enc:v1:${"A".repeat(2100)}`, source: "member" })).error).not.toBeNull();
  });
});
