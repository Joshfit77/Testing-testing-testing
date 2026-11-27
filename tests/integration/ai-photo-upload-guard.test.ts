import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The AI photo endpoints (/api/ai/food-photo, /api/ai/label-photo) buffer an upload of up to 5 MB and decode and
 * re-encode it before the AI is asked anything. That work must not be available to an account whose plan has no AI
 * (Free), and not without limit to anyone: the plan and a per-member upload limit are checked before the photo is
 * read (src/server/services/ai-photo-guard.ts).
 *
 * The probe is a file with a PNG signature and nothing decodable after it. A server that reads and decodes it answers
 * 415 `invalid_image`; a server that refuses first never gets that far.
 */
vi.mock("next/headers", () => ({
  // A bearer request carries no session cookies.
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
// Nothing may reach a real AI provider from this test: a request that got that far fails on this closed port.
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const available = await stackAvailable();

const UNDECODABLE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PNG_1X1 = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

describe.skipIf(!available)("AI photo uploads: plan and upload limit are checked before the photo is read", () => {
  let pro: TestUser;
  let free: TestUser;
  const svc = serviceClient();
  const token = async (u: TestUser) => (await u.client.auth.getSession()).data.session!.access_token;

  const upload = async (route: "food-photo" | "label-photo", u: TestUser, bytes: Uint8Array<ArrayBuffer>) => {
    const { POST } = route === "food-photo" ? await import("@/app/api/ai/food-photo/route") : await import("@/app/api/ai/label-photo/route");
    const form = new FormData();
    form.append("photo", new Blob([bytes], { type: "image/png" }), "photo.png");
    const built = new Request(`http://localhost:3000/api/ai/${route}`, { method: "POST", body: form });
    const body = await built.arrayBuffer();
    return POST(
      new NextRequest(built.url, {
        method: "POST",
        headers: { authorization: `Bearer ${await token(u)}`, "content-type": built.headers.get("content-type")!, "content-length": String(body.byteLength) },
        body,
      }),
    );
  };
  const usageCount = async (u: TestUser) => (await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", u.id)).count ?? 0;

  beforeAll(async () => {
    [pro, free] = await Promise.all([createTestUser("photo-guard-pro"), createTestUser("photo-guard-free")]);
    await grantPlan(pro, "pro");
    const now = new Date().toISOString();
    // Both have agreed to everything, so the only thing that can refuse the Free member is the plan.
    await svc.from("profiles").update({ ai_data_consent_at: now, food_photo_consent_at: now }).in("id", [pro.id, free.id]);
  });
  afterAll(async () => Promise.all([deleteTestUser(pro), deleteTestUser(free)]));

  it.each(["food-photo", "label-photo"] as const)("a Free member's upload to %s is refused on the plan before it is decoded", async (route) => {
    const res = await upload(route, free, UNDECODABLE_PNG);
    // 415 here would mean the server parsed and tried to decode the upload of an account with no AI at all.
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_entitled");
    expect(await usageCount(free)).toBe(0);
  });

  it("a Pro member's valid photo still goes all the way to the AI provider", async () => {
    const res = await upload("food-photo", pro, PNG_1X1);
    // Only the (closed) provider port stopped it: plan, upload limit, consent and allowance all passed.
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("provider");
    expect(await usageCount(pro)).toBe(0); // the failed call was given back
  });

  it("uploads are limited per member before decoding, across both endpoints", async () => {
    const { PHOTO_UPLOADS_PER_MINUTE } = await import("@/server/services/ai-photo-guard");
    const member = await createTestUser("photo-guard-burst");
    try {
      await grantPlan(member, "pro");
      const statuses: number[] = [];
      for (let i = 0; i < PHOTO_UPLOADS_PER_MINUTE; i++) statuses.push((await upload(i % 2 ? "label-photo" : "food-photo", member, UNDECODABLE_PNG)).status);
      // Within the limit each upload is read, and refused as an unreadable image.
      expect(new Set(statuses)).toEqual(new Set([415]));
      for (const route of ["food-photo", "label-photo"] as const) {
        const res = await upload(route, member, UNDECODABLE_PNG);
        expect(res.status).toBe(429);
        expect((await res.json()).error).toBe("rate_limited");
        expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
      }
      // Another member is unaffected.
      expect((await upload("food-photo", pro, UNDECODABLE_PNG)).status).toBe(415);
    } finally {
      await deleteTestUser(member);
    }
  });
});
