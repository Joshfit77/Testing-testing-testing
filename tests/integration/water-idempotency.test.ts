import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * N7: water logging is idempotent per device tap (water_entries.client_id, migration 20261112000058). The member's
 * session is real; only the request plumbing (cookies, revalidation) is stubbed.
 */
let current: SupabaseClient;
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const available = await stackAvailable();

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe.skipIf(!available)("water logging with a client id", () => {
  let user: TestUser;
  let other: TestUser;
  const svc = serviceClient();
  const day = "2026-11-12";

  beforeAll(async () => {
    [user, other] = await Promise.all([createTestUser("water-idem"), createTestUser("water-idem-other")]);
    current = user.client;
  });
  afterAll(async () => {
    await Promise.all([deleteTestUser(user), deleteTestUser(other)]);
  });

  const rows = async (userId: string) => (await svc.from("water_entries").select("id, amount_ml, client_id").eq("user_id", userId).eq("recorded_on", day)).data ?? [];

  it("the same client id submitted twice yields one row, and the retry reports that row and the same total", async () => {
    const { addWaterAction } = await import("@/server/actions/nutrition");
    const clientId = randomUUID();
    const first = await addWaterAction({ ok: false }, form({ date: day, amountMl: "250", clientId }));
    const retry = await addWaterAction({ ok: false }, form({ date: day, amountMl: "250", clientId }));
    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    expect(retry.entryId).toBe(first.entryId);
    expect(first.totalMl).toBe(250);
    expect(retry.totalMl).toBe(250);
    const mine = await rows(user.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: first.entryId, amount_ml: 250, client_id: clientId });
  });

  it("a new tap (new id) and calls without an id (older clients) still add water", async () => {
    const { addWaterAction } = await import("@/server/actions/nutrition");
    const next = await addWaterAction({ ok: false }, form({ date: day, amountMl: "500", clientId: randomUUID() }));
    expect(next.totalMl).toBe(750);
    await addWaterAction({ ok: false }, form({ date: day, amountMl: "100" }));
    const legacy = await addWaterAction({ ok: false }, form({ date: day, amountMl: "100" }));
    expect(legacy.ok).toBe(true);
    expect(legacy.totalMl).toBe(950);
    const mine = await rows(user.id);
    expect(mine).toHaveLength(4);
    expect(mine.filter((r) => r.client_id == null)).toHaveLength(2);
  });

  it("the database refuses a repeated (user, client id) but not the same id for another member", async () => {
    const clientId = randomUUID();
    expect((await user.client.from("water_entries").insert({ user_id: user.id, recorded_on: day, amount_ml: 200, client_id: clientId })).error).toBeNull();
    const dup = await user.client.from("water_entries").insert({ user_id: user.id, recorded_on: day, amount_ml: 200, client_id: clientId });
    expect(dup.error?.code).toBe("23505");
    expect((await other.client.from("water_entries").insert({ user_id: other.id, recorded_on: day, amount_ml: 200, client_id: clientId })).error).toBeNull();
    // Rows without an id are never constrained.
    expect((await other.client.from("water_entries").insert({ user_id: other.id, recorded_on: day, amount_ml: 200 })).error).toBeNull();
    expect((await other.client.from("water_entries").insert({ user_id: other.id, recorded_on: day, amount_ml: 200 })).error).toBeNull();
    expect(await rows(other.id)).toHaveLength(3);
  });
});
