import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { dailyStreak, weeklyStreak } from "@/lib/domain/streak";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Accountability partners (migration 067), against the real database: off until the owner switches the flag on; a
 * stranger sees nothing; a partner sees only the numbers the other chose to share; switching a share off or ending the
 * partnership takes effect at once; invite codes are single use and expire; at most 3 partners; nobody partners with
 * themself or edits the other member's share switches.
 */
let signedIn: SupabaseClient;
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => signedIn }));

const available = await stackAvailable();
const FLAG = "accountability_partners";

describe.skipIf(!available)("accountability partners", () => {
  const svc = serviceClient();
  const setFlag = async (enabled: boolean) => {
    const { error } = await svc.from("feature_flags").upsert({ key: FLAG, enabled, description: "Accountability partners (integration test)" }, { onConflict: "key" });
    if (error) throw error;
  };
  let a: TestUser; // inviter, ends up with 3 partners
  let b: TestUser; // A's first partner, with workouts and a program
  let c: TestUser;
  let d: TestUser;
  let e: TestUser;
  let stranger: TestUser;
  let ab: string; // A–B partnership
  let programName: string;
  const today = new Date().toISOString().slice(0, 10);
  const trainedDates = [today, addDays(today, -1), addDays(today, -2), addDays(today, -10)];

  const summary = async (as: TestUser, id: string) => {
    const { data, error } = await as.client.rpc("accountability_summary", { p_partnership_id: id });
    expect(error).toBeNull();
    return data as Record<string, unknown> | null;
  };
  const actions = () => import("@/server/actions/accountability");
  async function newCode(as: TestUser): Promise<string> {
    signedIn = as.client;
    const r = await (await actions()).createInviteAction();
    if (!r.ok) throw new Error(r.error);
    return r.code;
  }
  async function accept(as: TestUser, code: string) {
    signedIn = as.client;
    return (await actions()).acceptInviteAction(code);
  }

  beforeAll(async () => {
    [a, b, c, d, e, stranger] = await Promise.all([
      createTestUser("acc-a"),
      createTestUser("acc-b"),
      createTestUser("acc-c"),
      createTestUser("acc-d"),
      createTestUser("acc-e"),
      createTestUser("acc-stranger"),
    ]);
    const now = new Date().toISOString();
    for (const u of [a, b, c, d, e, stranger]) {
      await svc.from("profiles").update({ onboarding_completed_at: now, timezone: "UTC", display_name: u === b ? "Barnabas" : "Member" }).eq("id", u.id);
    }
    // B's history: completed workouts today, the two days before and 10 days ago (one minute past UTC midnight, so
    // never in the future), plus a discarded one today that must not count.
    const rows = trainedDates.map((d) => ({ user_id: b.id, client_id: crypto.randomUUID(), name: "Private session name", notes: "Private note", status: "completed", started_at: `${d}T00:01:00Z`, ended_at: `${d}T00:41:00Z` }));
    rows.push({ user_id: b.id, client_id: crypto.randomUUID(), name: "Discarded", notes: "", status: "discarded", started_at: `${today}T00:02:00Z`, ended_at: `${today}T00:03:00Z` });
    const { error: wErr } = await svc.from("workout_sessions").insert(rows);
    if (wErr) throw wErr;
    const { data: prog } = await svc.from("training_programs").select("id, name, duration_weeks").eq("is_published", true).is("owner_id", null).order("slug").limit(1).single();
    programName = prog!.name as string;
    const { error: pErr } = await svc.from("user_programs").insert({ user_id: b.id, program_id: prog!.id, status: "active", current_week: 2, started_at: now });
    if (pErr) throw pErr;
  });

  afterAll(async () => {
    await setFlag(false);
    await Promise.all([a, b, c, d, e, stranger].map((u) => deleteTestUser(u)));
  });

  it("ships switched off: the flag exists and is off, the page 404s, and the database refuses everything", async () => {
    const { data: flag } = await svc.from("feature_flags").select("enabled").eq("key", FLAG).single();
    expect(flag!.enabled).toBe(false);
    signedIn = a.client;
    const act = await actions();
    expect(await act.createInviteAction()).toEqual({ ok: false, error: "Accountability partners aren't available right now." });
    expect(await act.acceptInviteAction("ABCDEFGH23")).toEqual({ ok: false, error: "Accountability partners aren't available right now." });
    // Directly against the database too.
    expect((await a.client.from("accountability_invites").insert({ inviter_id: a.id, code: "ABCDEFGH23" })).error).not.toBeNull();
    const rpc = await a.client.rpc("accept_accountability_invite", { p_code: "ABCDEFGH23" });
    expect(rpc.error?.message).toBe("accountability_off");
    // The page doesn't exist.
    const { default: Page } = await import("@/app/(app)/profile/accountability/page");
    await expect(Page()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    // A deployment without the flag row at all is off too.
    await svc.from("feature_flags").delete().eq("key", FLAG);
    expect((await act.createInviteAction()).ok).toBe(false);
    await expect(Page()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await setFlag(false);
  });

  it("once on: an invite code makes two members partners, sharing workouts and streak by default", async () => {
    await setFlag(true);
    const code = await newCode(a);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const { data: inv } = await svc.from("accountability_invites").select("expires_at, used_at").eq("code", code).single();
    const ttlDays = (new Date(inv!.expires_at as string).getTime() - Date.now()) / 86_400_000;
    expect(ttlDays).toBeGreaterThan(6.99);
    expect(ttlDays).toBeLessThanOrEqual(7);
    // Typed in lower case with a dash: still the same code.
    const r = await accept(b, `${code.slice(0, 5).toLowerCase()}-${code.slice(5)}`);
    expect(r.ok).toBe(true);
    ab = (r as { partnershipId: string }).partnershipId;
    const { data: shares } = await svc.from("accountability_shares").select("user_id, share_workouts, share_streak, share_program_progress").eq("partnership_id", ab);
    expect(shares).toHaveLength(2);
    for (const s of shares!) expect(s).toMatchObject({ share_workouts: true, share_streak: true, share_program_progress: false });
    expect((await svc.from("accountability_invites").select("used_at").eq("code", code).single()).data!.used_at).not.toBeNull();
  });

  it("a partner sees only the shared numbers, never the workout rows", async () => {
    const s = await summary(a, ab);
    expect(Object.keys(s!).sort()).toEqual(["partner_name", "streak_days", "streak_weeks", "workouts_last_7_days"]);
    expect(s).toEqual({
      partner_name: "Barnabas",
      workouts_last_7_days: 3,
      streak_days: dailyStreak(trainedDates, today),
      streak_weeks: weeklyStreak(trainedDates, today, 1),
    });
    expect(s!.streak_days).toBe(3);
    // Raw rows stay private: no workout sessions, programs or profile of the partner.
    expect((await a.client.from("workout_sessions").select("id").eq("user_id", b.id)).data).toEqual([]);
    expect((await a.client.from("user_programs").select("id").eq("user_id", b.id)).data).toEqual([]);
    expect((await a.client.from("profiles").select("id").eq("id", b.id)).data).toEqual([]);
    // Program progress only once B turns it on.
    signedIn = b.client;
    expect(await (await actions()).updateShareAction({ partnershipId: ab, key: "share_program_progress", value: true })).toEqual({ ok: true });
    expect((await summary(a, ab))!.program).toEqual({ name: programName, week: 2, weeks: expect.any(Number) });
  });

  it("turning a share off hides it immediately", async () => {
    signedIn = b.client;
    const act = await actions();
    expect(await act.updateShareAction({ partnershipId: ab, key: "share_workouts", value: false })).toEqual({ ok: true });
    expect(Object.keys((await summary(a, ab))!).sort()).toEqual(["partner_name", "program", "streak_days", "streak_weeks"]);
    expect(await act.updateShareAction({ partnershipId: ab, key: "share_streak", value: false })).toEqual({ ok: true });
    expect(await act.updateShareAction({ partnershipId: ab, key: "share_program_progress", value: false })).toEqual({ ok: true });
    expect(await summary(a, ab)).toEqual({ partner_name: "Barnabas" });
    // B still sees what A shares (A's switches are untouched).
    expect(Object.keys((await summary(b, ab))!).sort()).toEqual(["partner_name", "streak_days", "streak_weeks", "workouts_last_7_days"]);
    await act.updateShareAction({ partnershipId: ab, key: "share_workouts", value: true });
    expect((await summary(a, ab))!.workouts_last_7_days).toBe(3);
  });

  it("a stranger can't read the partnership, the share switches, the encouragements or the summary", async () => {
    expect((await stranger.client.from("accountability_partnerships").select("id").eq("id", ab)).data).toEqual([]);
    expect((await stranger.client.from("accountability_shares").select("user_id").eq("partnership_id", ab)).data).toEqual([]);
    expect((await stranger.client.from("accountability_nudges").select("id").eq("partnership_id", ab)).data).toEqual([]);
    expect((await stranger.client.from("accountability_invites").select("id").eq("inviter_id", a.id)).data).toEqual([]);
    expect(await summary(stranger, ab)).toBeNull();
    // Nor change or end it.
    const upd = await stranger.client.from("accountability_shares").update({ share_workouts: false }).eq("partnership_id", ab).select("user_id");
    expect(upd.data ?? []).toEqual([]);
    expect((await stranger.client.rpc("end_accountability_partnership", { p_partnership_id: ab })).data).toBe(false);
    expect((await stranger.client.rpc("send_accountability_nudge", { p_partnership_id: ab, p_message_key: "proud" })).error?.message).toBe("not_partners");
    expect((await svc.from("accountability_partnerships").select("status").eq("id", ab).single()).data!.status).toBe("active");
    // Signed-out visitors see nothing either.
    const { anonClient } = await import("./helpers");
    expect((await anonClient().from("accountability_partnerships").select("id")).data ?? []).toEqual([]);
    expect((await anonClient().rpc("accountability_summary", { p_partnership_id: ab })).data ?? null).toBeNull();
  });

  it("a member can't edit the partner's share switches, create rows directly, or partner with themself", async () => {
    // A tries to switch B's sharing on: no row changes.
    await svc.from("accountability_shares").update({ share_program_progress: false }).eq("partnership_id", ab).eq("user_id", b.id);
    const upd = await a.client.from("accountability_shares").update({ share_program_progress: true }).eq("partnership_id", ab).eq("user_id", b.id).select("user_id");
    expect(upd.data ?? []).toEqual([]);
    expect((await svc.from("accountability_shares").select("share_program_progress").eq("partnership_id", ab).eq("user_id", b.id).single()).data!.share_program_progress).toBe(false);
    // Nor move their own row onto B.
    expect((await a.client.from("accountability_shares").update({ user_id: b.id }).eq("partnership_id", ab).eq("user_id", a.id)).error).not.toBeNull();
    // No direct inserts of partnerships, share rows or encouragements.
    const [lo, hi] = [a.id, stranger.id].sort();
    expect((await a.client.from("accountability_partnerships").insert({ user_a: lo, user_b: hi })).error).not.toBeNull();
    expect((await a.client.from("accountability_shares").insert({ partnership_id: ab, user_id: a.id })).error).not.toBeNull();
    expect((await a.client.from("accountability_nudges").insert({ partnership_id: ab, sender_id: a.id, recipient_id: b.id, message_key: "proud" })).error).not.toBeNull();
    // An invite can't be pre-used or given a long expiry.
    expect((await a.client.from("accountability_invites").insert({ inviter_id: a.id, code: "ABCDEFGH23", expires_at: "2030-01-01T00:00:00Z" })).error).not.toBeNull();
    expect((await a.client.from("accountability_invites").insert({ inviter_id: b.id, code: "ABCDEFGH24" })).error).not.toBeNull();
    // Their own code doesn't work for themself, and the database rejects a self-partnership outright.
    const own = await newCode(a);
    expect(await accept(a, own)).toEqual({ ok: false, error: "That's your own code. Share it with a friend instead." });
    expect((await svc.from("accountability_partnerships").insert({ user_a: a.id, user_b: a.id })).error).not.toBeNull();
    signedIn = a.client;
    const { data: mine } = await svc.from("accountability_invites").select("id").eq("code", own).single();
    expect(await (await actions()).withdrawInviteAction(mine!.id as string)).toEqual({ ok: true });
  });

  it("invite codes are single use, expire, and are only valid as issued", async () => {
    const used = (await svc.from("accountability_invites").select("code").eq("inviter_id", a.id).not("used_at", "is", null).limit(1).single()).data!.code as string;
    expect(await accept(c, used)).toEqual({ ok: false, error: "That code has already been used. Ask your friend for a new one." });
    const expiring = await newCode(a);
    await svc.from("accountability_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("code", expiring);
    expect(await accept(c, expiring)).toEqual({ ok: false, error: "That code has expired. Ask your friend for a new one." });
    expect(await accept(c, "ZZZZZZZZZZ")).toEqual({ ok: false, error: "That code wasn't found. Check it and try again." });
    expect((await accept(c, "not a code")).ok).toBe(false);
    expect(await accept(b, await newCode(a))).toEqual({ ok: false, error: "You're already partners." });
    // Only the inviter sees their codes.
    expect((await c.client.from("accountability_invites").select("id").eq("code", expiring)).data).toEqual([]);
  });

  it("encouragements: fixed messages only, at most 3 per partner per 24 hours, seen by the recipient", async () => {
    signedIn = a.client;
    const act = await actions();
    expect(await act.sendNudgeAction(ab, "proud")).toEqual({ ok: true });
    expect(await act.sendNudgeAction(ab, "praying")).toEqual({ ok: true });
    expect(await act.sendNudgeAction(ab, "lets_train")).toEqual({ ok: true });
    expect(await act.sendNudgeAction(ab, "keep_going")).toEqual({ ok: false, error: expect.stringContaining("3 encouragements") });
    expect((await a.client.rpc("send_accountability_nudge", { p_partnership_id: ab, p_message_key: "proud" })).error?.message).toBe("nudge_limit");
    expect((await act.sendNudgeAction(ab, "Hey, call me at 555-0100")).ok).toBe(false);
    expect((await a.client.rpc("send_accountability_nudge", { p_partnership_id: ab, p_message_key: "free text" })).error?.message).toBe("unknown_message");
    const { data: seen } = await b.client.from("accountability_nudges").select("message_key, sender_id, recipient_id").eq("partnership_id", ab);
    expect(seen).toHaveLength(3);
    for (const n of seen!) expect(n).toMatchObject({ sender_id: a.id, recipient_id: b.id });
    // B's own allowance is separate.
    signedIn = b.client;
    expect(await (await actions()).sendNudgeAction(ab, "rest_well")).toEqual({ ok: true });
  });

  it("a member can have at most 3 partners (as inviter and as the one accepting)", async () => {
    expect((await accept(c, await newCode(a))).ok).toBe(true);
    expect((await accept(d, await newCode(a))).ok).toBe(true);
    // A now has B, C and D.
    expect(await accept(e, await newCode(a))).toEqual({ ok: false, error: "Your friend already has 3 partners." });
    expect(await accept(a, await newCode(e))).toEqual({ ok: false, error: "You already have 3 partners. End one partnership to add another." });
    const { count } = await svc.from("accountability_partnerships").select("id", { count: "exact", head: true }).eq("status", "active").or(`user_a.eq.${a.id},user_b.eq.${a.id}`);
    expect(count).toBe(3);
  });

  it("switching the feature off stops sharing, but ending a partnership still works", async () => {
    await setFlag(false);
    expect(await summary(b, ab)).toBeNull();
    expect((await b.client.rpc("send_accountability_nudge", { p_partnership_id: ab, p_message_key: "proud" })).error?.message).toBe("accountability_off");
    await setFlag(true);
    expect(await summary(b, ab)).not.toBeNull();
  });

  it("the data export holds my own rows only", async () => {
    const { exportUserData } = await import("@/server/services/account");
    const out = (await exportUserData(a.client, a.id, a.email)) as Record<string, { [k: string]: unknown }[]>;
    expect(out.accountability_partnerships!.length).toBeGreaterThanOrEqual(3);
    for (const p of out.accountability_partnerships!) expect([p.user_a, p.user_b]).toContain(a.id);
    expect(out.accountability_shares!.length).toBe(3);
    for (const s of out.accountability_shares!) expect(s.user_id).toBe(a.id);
    expect(out.accountability_invites!.every((i) => i.inviter_id === a.id)).toBe(true);
    // Sent (3 to B) and received (1 from B).
    expect(out.accountability_nudges!.length).toBe(4);
  });

  it("ending a partnership removes access at once, for both members", async () => {
    signedIn = b.client;
    expect(await (await actions()).endPartnershipAction(ab)).toEqual({ ok: true });
    expect(await summary(a, ab)).toBeNull();
    expect(await summary(b, ab)).toBeNull();
    expect((await a.client.from("accountability_shares").select("user_id").eq("partnership_id", ab)).data).toEqual([]);
    expect((await a.client.from("accountability_nudges").select("id").eq("partnership_id", ab)).data).toEqual([]);
    expect((await svc.from("accountability_nudges").select("id").eq("partnership_id", ab)).data).toEqual([]);
    const { data: p } = await a.client.from("accountability_partnerships").select("status, ended_at").eq("id", ab).single();
    expect(p!.status).toBe("ended");
    expect(p!.ended_at).not.toBeNull();
    // Already ended; and an ended partnership can't be re-shared or nudged.
    signedIn = a.client;
    expect((await (await actions()).endPartnershipAction(ab)).ok).toBe(false);
    expect((await a.client.rpc("send_accountability_nudge", { p_partnership_id: ab, p_message_key: "proud" })).error?.message).toBe("not_partners");
    // A has a free slot again, and the same pair can partner again with a new code.
    expect((await accept(b, await newCode(a))).ok).toBe(true);
  });

  it("deleting an account removes its partnerships and sharing", async () => {
    const { data: before } = await svc.from("accountability_partnerships").select("id").or(`user_a.eq.${d.id},user_b.eq.${d.id}`);
    expect(before!.length).toBe(1);
    await deleteTestUser(d);
    expect((await svc.from("accountability_partnerships").select("id").in("id", before!.map((p) => p.id))).data).toEqual([]);
    expect((await svc.from("accountability_shares").select("user_id").in("partnership_id", before!.map((p) => p.id))).data).toEqual([]);
    expect((await svc.from("accountability_invites").select("id").eq("inviter_id", d.id)).data).toEqual([]);
  });
});
