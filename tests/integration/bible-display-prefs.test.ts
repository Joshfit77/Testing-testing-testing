import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * The Bible reader's Red Letters and reading-page settings (migration 054): on and dark by default for every account
 * (Free included), saved per account, and never readable or writable by another member.
 */
describe.skipIf(!available)("Bible display settings (Red Letters, reading page)", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    a = await createTestUser("redletters-a");
    b = await createTestUser("redletters-b");
  });
  afterAll(async () => {
    await deleteTestUser(a);
    await deleteTestUser(b);
  });

  const read = async (u: TestUser, id: string) => (await u.client.from("profiles").select("bible_red_letters, bible_page_theme").eq("id", id).maybeSingle()).data;

  it("new Free accounts start with red letters on and the dark page", async () => {
    expect(await read(a, a.id)).toEqual({ bible_red_letters: true, bible_page_theme: "dark" });
    const { data: plan, error } = await serviceClient().rpc("plan_of", { p_user_id: a.id });
    expect(error).toBeNull();
    expect(plan).toBe("free");
  });

  it("a member's choice is saved and read back", async () => {
    const { error } = await a.client.from("profiles").update({ bible_red_letters: false, bible_page_theme: "light" }).eq("id", a.id);
    expect(error).toBeNull();
    expect(await read(a, a.id)).toEqual({ bible_red_letters: false, bible_page_theme: "light" });
  });

  it("one member's setting doesn't change another's, and nobody can read or change someone else's", async () => {
    expect(await read(b, b.id)).toEqual({ bible_red_letters: true, bible_page_theme: "dark" });
    expect(await read(b, a.id)).toBeNull();
    const { data: changed } = await b.client.from("profiles").update({ bible_red_letters: true }).eq("id", a.id).select("id");
    expect(changed ?? []).toHaveLength(0);
    expect(await read(a, a.id)).toEqual({ bible_red_letters: false, bible_page_theme: "light" });
  });

  it("only the two reading pages are accepted", async () => {
    const { error } = await a.client.from("profiles").update({ bible_page_theme: "sepia" }).eq("id", a.id);
    expect(error).not.toBeNull();
  });
});
