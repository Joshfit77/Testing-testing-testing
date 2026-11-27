import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The AI endpoints over HTTP, as a native client calls them: `Authorization: Bearer <access token>`, no cookies.
 * The member's plan and limits must come from the server (their entitlement and usage rows), and a member over
 * their monthly allowance must be refused before anything reaches the AI provider.
 */
vi.mock("next/headers", () => ({
  // A bearer request carries no session cookies.
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
// Nothing may reach a real AI provider from this test: a refused request never gets this far, and one that
// slipped through would fail on this closed port instead of spending money.
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const available = await stackAvailable();

describe.skipIf(!available)("AI routes: plan and monthly limits are enforced server-side for bearer clients", () => {
  let pro: TestUser;
  let free: TestUser;
  const svc = serviceClient();
  const token = async (u: TestUser) => (await u.client.auth.getSession()).data.session!.access_token;
  const chat = async (u: TestUser, body: Record<string, unknown> = { conversationId: null, message: "How should I progress my squat?", mode: "chat" }) => {
    const { POST } = await import("@/app/api/ai/chat/route");
    return POST(
      new NextRequest("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: { authorization: `Bearer ${await token(u)}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  };
  const usageCount = async (u: TestUser) => (await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", u.id)).count ?? 0;

  beforeAll(async () => {
    [pro, free] = await Promise.all([createTestUser("ai-route-pro"), createTestUser("ai-route-free")]);
    await grantPlan(pro, "pro");
    const now = new Date().toISOString();
    await svc.from("profiles").update({ ai_data_consent_at: now, food_photo_consent_at: now }).in("id", [pro.id, free.id]);
    // The Pro member has used the whole monthly allowance (150 by default) earlier this month, outside the burst window.
    const d = new Date();
    const earlier = new Date(Math.max(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 1000, d.getTime() - 5 * 60_000)).toISOString();
    const { error } = await svc.from("ai_usage_events").insert(Array.from({ length: 150 }, () => ({ user_id: pro.id, kind: "chat", model_tier: "fast", created_at: earlier })));
    if (error) throw error;
  });
  afterAll(async () => Promise.all([deleteTestUser(pro), deleteTestUser(free)]));

  it("refuses requests without a valid token", async () => {
    const { POST } = await import("@/app/api/ai/chat/route");
    const res = await POST(new NextRequest("http://localhost:3000/api/ai/chat", { method: "POST", headers: { authorization: "Bearer not-a-token" }, body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("a Pro member over the monthly allowance gets 429 quota, and nothing is saved or counted", async () => {
    const res = await chat(pro);
    const body = await res.json();
    expect(body.error).toBe("quota");
    expect(res.status).toBe(429);
    expect(await usageCount(pro)).toBe(150);
    expect((await svc.from("ai_conversations").select("id").eq("user_id", pro.id)).data).toEqual([]);
    expect((await svc.from("ai_messages").select("id").eq("user_id", pro.id)).data).toEqual([]);
  });

  it("a Pro member within the allowance gets past every check; a failed provider call is given back", async () => {
    const fresh = await createTestUser("ai-route-pro-ok");
    try {
      await grantPlan(fresh, "pro");
      await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString() }).eq("id", fresh.id);
      const res = await chat(fresh);
      // Only the (closed) provider port stopped it: plan, consent and allowance all passed.
      expect(res.status).toBe(502);
      expect((await res.json()).error).toBe("provider");
      expect(await usageCount(fresh)).toBe(0);
      expect((await svc.from("ai_messages").select("id").eq("user_id", fresh.id)).data).toEqual([]);
    } finally {
      await deleteTestUser(fresh);
    }
  });

  it("a Free member is refused (the coach is Pro), whatever the request says", async () => {
    const res = await chat(free, { conversationId: null, message: "Write me a plan", mode: "plan" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_entitled");
    expect(await usageCount(free)).toBe(0);
  });

  it("the meal-photo endpoint applies the same allowance", async () => {
    const { POST } = await import("@/app/api/ai/food-photo/route");
    const form = new FormData();
    // A real (1×1) image: the server decodes and re-encodes the photo before anything else, so a header-only file would
    // be refused as an invalid image before the allowance is checked.
    const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
    form.append("photo", new Blob([png], { type: "image/png" }), "meal.png");
    const req = new Request("http://localhost:3000/api/ai/food-photo", { method: "POST", headers: { authorization: `Bearer ${await token(pro)}` }, body: form });
    const bytes = await req.clone().arrayBuffer();
    const res = await POST(new NextRequest(req.url, { method: "POST", headers: { authorization: `Bearer ${await token(pro)}`, "content-type": req.headers.get("content-type")!, "content-length": String(bytes.byteLength) }, body: bytes }));
    const body = await res.json();
    expect(body.error).toBe("quota");
    expect(res.status).toBe(429);
    expect(await usageCount(pro)).toBe(150);
  });
});
