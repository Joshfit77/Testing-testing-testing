import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, exerciseIds, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

describe.skipIf(!available)("barcode foods & exercise media uploads", () => {
  let user: TestUser;
  let other: TestUser;
  let admin: TestUser;
  let ex: Record<string, string>;
  const code = `${Date.now()}`.slice(-13).padStart(13, "0");

  beforeAll(async () => {
    [user, other, admin] = await Promise.all([createTestUser("barcode"), createTestUser("barcode-other"), createTestUser("media-admin")]);
    await serviceClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    ex = await exerciseIds(["back-squat"]);
  });

  afterAll(async () => {
    await Promise.all([deleteTestUser(user), deleteTestUser(other), deleteTestUser(admin)]);
  });

  const food = (ownerId: string | null) => ({
    owner_id: ownerId,
    name: "Hazelnut spread",
    brand: "Example",
    serving_size: 100,
    serving_unit: "g",
    calories: 539,
    protein_g: 6.3,
    carbs_g: 57.5,
    fat_g: 30.9,
    source: "openfoodfacts",
    source_ref: code,
  });

  it("users can cache Open Food Facts products for themselves (upsert by barcode)", async () => {
    const first = await user.client.from("foods").upsert(food(user.id), { onConflict: "owner_id,source,source_ref" }).select("id").single();
    expect(first.error).toBeNull();
    const again = await user.client.from("foods").upsert({ ...food(user.id), calories: 540 }, { onConflict: "owner_id,source,source_ref" }).select("id, calories").single();
    expect(again.error).toBeNull();
    expect(again.data?.id).toBe(first.data?.id);
    const { data: seen } = await other.client.from("foods").select("id").eq("id", first.data!.id);
    expect(seen).toEqual([]);
  });

  it("users cannot cache products for others or as public foods, and unknown sources are rejected", async () => {
    expect((await user.client.from("foods").insert(food(other.id))).error).not.toBeNull();
    expect((await user.client.from("foods").insert(food(null))).error).not.toBeNull();
    expect((await user.client.from("foods").insert({ ...food(user.id), source: "scraped", source_ref: `${code}x` })).error).not.toBeNull();
  });

  it("only admins can upload to the exercise-media bucket", async () => {
    const path = `back-squat/it-${crypto.randomUUID()}.mp4`;
    const body = new Blob([new Uint8Array([0, 0, 0, 24])], { type: "video/mp4" });
    const denied = await user.client.storage.from("exercise-media").upload(path, body, { contentType: "video/mp4" });
    expect(denied.error).not.toBeNull();
    const ok = await admin.client.storage.from("exercise-media").upload(path, body, { contentType: "video/mp4" });
    expect(ok.error).toBeNull();
    const row = await admin.client
      .from("exercise_media")
      .insert({ exercise_id: ex["back-squat"], media_type: "video", storage_path: path, license: "AI-generated, owned by Narrow Gate Fitness", alt_text: "Back squat demonstration" })
      .select("id")
      .single();
    expect(row.error).toBeNull();
    await admin.client.from("exercise_media").delete().eq("id", row.data!.id);
    const removed = await admin.client.storage.from("exercise-media").remove([path]);
    expect(removed.error).toBeNull();
  });
});
