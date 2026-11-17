import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialActionState } from "@/lib/action-state";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * The separate prayer-journal permission (migration 080, owner decision 2026-11-17): no journal entry may be marked for
 * the AI Coach, or read for it, until the member turns this on; turning it (or the AI consent) off makes every entry
 * private again. The real server actions run with the member's own session; only cookies and revalidation are stubbed.
 * What reaches the provider is covered in ai-consent and ai-outgoing-payloads.
 */
let current: SupabaseClient;
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const available = await stackAvailable();

describe.skipIf(!available)("prayer journal: separate permission before any entry is shared with the AI Coach", () => {
  let m: TestUser;
  let other: TestUser;
  const svc = serviceClient();
  const today = new Date().toISOString().slice(0, 10);

  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };
  const profile = async () => (await svc.from("profiles").select("journal_ai_consent_at, ai_data_consent_at").eq("id", m.id).single()).data!;
  const entries = async () => ((await svc.from("faith_journal_entries").select("id, body, share_with_coach").eq("user_id", m.id).order("created_at")).data ?? []) as { id: string; body: string; share_with_coach: boolean }[];

  beforeAll(async () => {
    [m, other] = await Promise.all([createTestUser("journal-ai"), createTestUser("journal-ai-other")]);
    current = m.client;
    const now = new Date().toISOString();
    await svc.from("profiles").update({ onboarding_completed_at: now, timezone: "UTC", faith_enabled: true, ai_data_consent_at: now }).eq("id", m.id);
  });
  afterAll(async () => Promise.all([deleteTestUser(m), deleteTestUser(other)]));

  it("is off for every member by default", async () => {
    expect((await profile()).journal_ai_consent_at).toBeNull();
  });

  it("without it, saving an entry marked 'Share with AI Coach' is refused and stores nothing", async () => {
    const { saveJournalEntryAction } = await import("@/server/actions/faith");
    const { JOURNAL_SHARE_NEEDS_CONSENT } = await import("@/lib/domain/journal");
    const res = await saveJournalEntryAction(initialActionState, form({ entryDate: today, kind: "daily", body: "A prayer marked shared", shareWithCoach: "on" }));
    expect(res).toMatchObject({ ok: false, message: JOURNAL_SHARE_NEEDS_CONSENT });
    expect(await entries()).toEqual([]);
    // A private entry saves as before.
    const ok = await saveJournalEntryAction(initialActionState, form({ entryDate: today, kind: "daily", body: "A private prayer" }));
    expect(ok.ok).toBe(true);
    expect((await entries()).map((e) => e.share_with_coach)).toEqual([false]);
  });

  it("without it, 'Share with AI Coach' on an existing entry changes nothing", async () => {
    const { setJournalShareAction } = await import("@/server/actions/faith");
    const [e] = await entries();
    await setJournalShareAction(form({ id: e!.id, share: "true" }));
    expect((await entries())[0]!.share_with_coach).toBe(false);
  });

  it("can't be turned on without the AI consent, or with faith features off", async () => {
    const { setJournalAiShareAction } = await import("@/server/actions/profile");
    await svc.from("profiles").update({ ai_data_consent_at: null }).eq("id", m.id);
    expect(await setJournalAiShareAction(true)).toMatchObject({ ok: false, message: "Turn on the AI Coach first." });
    await svc.from("profiles").update({ ai_data_consent_at: new Date().toISOString(), faith_enabled: false }).eq("id", m.id);
    expect(await setJournalAiShareAction(true)).toMatchObject({ ok: false, message: "Turn on faith features first." });
    expect((await profile()).journal_ai_consent_at).toBeNull();
    await svc.from("profiles").update({ faith_enabled: true }).eq("id", m.id);
  });

  it("once on, entries can be marked one by one; turning it on shares nothing, not even an entry marked before it existed", async () => {
    const { setJournalAiShareAction } = await import("@/server/actions/profile");
    const { saveJournalEntryAction, setJournalShareAction } = await import("@/server/actions/faith");
    const { loadAthleteSnapshot } = await import("@/server/coach/snapshot");
    // An entry marked before the permission existed (or set directly through the API): it must not start sharing.
    const { data: legacy } = await svc.from("faith_journal_entries").insert({ user_id: m.id, entry_date: today, body: "LEGACY-MARKED entry", share_with_coach: true }).select("id").single();
    expect((await setJournalAiShareAction(true)).ok).toBe(true);
    expect((await profile()).journal_ai_consent_at).not.toBeNull();
    expect((await entries()).every((e) => !e.share_with_coach)).toBe(true);
    expect(JSON.stringify((await loadAthleteSnapshot(m.client, m.id)).sharedJournal)).not.toContain("LEGACY-MARKED");
    await svc.from("faith_journal_entries").delete().eq("id", legacy!.id);
    expect((await saveJournalEntryAction(initialActionState, form({ entryDate: today, kind: "praise", body: "Shared praise", shareWithCoach: "on" }))).ok).toBe(true);
    const [first] = await entries();
    await setJournalShareAction(form({ id: first!.id, share: "true" }));
    expect((await entries()).map((e) => e.share_with_coach)).toEqual([true, true]);
  });

  it("turning it off makes every entry private again, and turning it back on doesn't resume sharing them", async () => {
    const { setJournalAiShareAction } = await import("@/server/actions/profile");
    expect((await setJournalAiShareAction(false)).ok).toBe(true);
    expect((await profile()).journal_ai_consent_at).toBeNull();
    expect((await entries()).map((e) => e.share_with_coach)).toEqual([false, false]);
    expect((await setJournalAiShareAction(true)).ok).toBe(true);
    expect((await entries()).map((e) => e.share_with_coach)).toEqual([false, false]);
  });

  it("withdrawing the AI consent also turns the journal permission off and unmarks every entry", async () => {
    const { setJournalShareAction } = await import("@/server/actions/faith");
    const { setAiDataConsentAction } = await import("@/server/actions/profile");
    const [first] = await entries();
    await setJournalShareAction(form({ id: first!.id, share: "true" }));
    expect((await entries())[0]!.share_with_coach).toBe(true);
    expect((await setAiDataConsentAction(false)).ok).toBe(true);
    expect(await profile()).toEqual({ journal_ai_consent_at: null, ai_data_consent_at: null });
    expect((await entries()).every((e) => !e.share_with_coach)).toBe(true);
  });

  it("a member can set only their own permission (row-level security)", async () => {
    const { data } = await m.client.from("profiles").update({ journal_ai_consent_at: new Date().toISOString() }).eq("id", other.id).select("id");
    expect(data ?? []).toEqual([]);
    expect((await svc.from("profiles").select("journal_ai_consent_at").eq("id", other.id).single()).data!.journal_ai_consent_at).toBeNull();
  });
});
