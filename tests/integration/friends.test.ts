import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, deleteTestUser, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Friends (migrations 076 to 078), against the real database: off until the owner switches the flag on; usernames are
 * unique and can't pass for staff; a stranger sees a username and nothing else; a request must be accepted before
 * anything is shared; a new friend sees the username and name only, and after that only what the other switched on;
 * removing or blocking takes effect at once; no member can write a friendship, a request or a block directly; reports
 * reach administrators only; deleting an account removes every trace.
 *
 * A block or a decline is not notified to the other member. Neither is concealed: the other member can infer it
 * (audit findings F-03 and F-04), and nothing here claims otherwise.
 */
let signedIn: SupabaseClient;
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => signedIn }));

const available = await stackAvailable();
const FLAG = "friends_challenges";
const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(-9);
const uname = (who: string) => `t${tag}_${who}`.slice(0, 20);

describe.skipIf(!available)("friends", () => {
  const svc = serviceClient();
  const setFlag = async (enabled: boolean) => {
    const { error } = await svc.from("feature_flags").upsert({ key: FLAG, enabled, description: "Friends (integration test)" }, { onConflict: "key" });
    if (error) throw error;
  };
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let d: TestUser;
  let admin: TestUser;
  let flagBefore: boolean;

  const actions = () => import("@/server/actions/friends");
  const as = async (u: TestUser) => {
    signedIn = u.client;
    return actions();
  };
  const rpcError = async (u: TestUser, fn: string, args: Record<string, unknown>) => (await u.client.rpc(fn, args)).error?.message ?? null;
  const profileOf = async (viewer: TestUser, target: TestUser) => (await viewer.client.rpc("friend_profile", { p_user_id: target.id })).data as Record<string, unknown> | null;
  const overview = async (u: TestUser) => (await u.client.rpc("friends_overview")).data as Record<string, { user_id: string; request_id?: string; username?: string }[]>;
  const search = async (u: TestUser, q: string) => ((await u.client.rpc("search_users", { p_query: q })).data ?? []) as { user_id: string; username: string; relation: string }[];
  /** What using an invite code did: "ok", "not_found" (the function returns null, migration 077) or the error's name. */
  const inviteOutcome = async (u: TestUser, code: string) => {
    const r = await u.client.rpc("accept_friend_invite", { p_code: code });
    return r.error?.message ?? (r.data === null ? "not_found" : "ok");
  };
  const friendsCount = async (u: TestUser) => (await svc.from("friendships").select("user_a", { count: "exact", head: true }).or(`user_a.eq.${u.id},user_b.eq.${u.id}`)).count ?? 0;

  beforeAll(async () => {
    flagBefore = (await svc.from("feature_flags").select("enabled").eq("key", FLAG).maybeSingle()).data?.enabled === true;
    [a, b, c, d, admin] = await Promise.all([createTestUser("fr-a"), createTestUser("fr-b"), createTestUser("fr-c"), createTestUser("fr-d"), createTestUser("fr-admin")]);
    await svc.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    await svc.from("profiles").update({ display_name: "Bea Private-Name" }).eq("id", b.id);
    // B trained today and yesterday.
    const now = Date.now();
    for (const [i, offset] of [0, 86_400_000].entries()) {
      const { error } = await svc.from("workout_sessions").insert({ user_id: b.id, client_id: crypto.randomUUID(), name: `fr-${i}`, status: "completed", started_at: new Date(now - offset - 3_600_000).toISOString(), ended_at: new Date(now - offset).toISOString() });
      if (error) throw error;
    }
    await setFlag(false);
  });

  afterAll(async () => {
    await setFlag(flagBefore);
    await Promise.all([a, b, c, d, admin].map((u) => deleteTestUser(u)));
  });

  it("is refused everywhere while the flag is off", async () => {
    expect(await rpcError(a, "claim_username", { p_username: uname("a") })).toBe("friends_off");
    expect(await rpcError(a, "send_friend_request", { p_user_id: b.id })).toBe("friends_off");
    expect(await search(a, "abc")).toEqual([]);
    expect((await a.client.rpc("friends_overview")).data).toBeNull();
    const r = await (await as(a)).claimUsernameAction(uname("a"));
    expect(r).toEqual({ ok: false, error: "Friends isn't available right now." });
    expect((await svc.from("social_profiles").select("user_id", { count: "exact", head: true }).eq("user_id", a.id)).count).toBe(0);
  });

  it("usernames: unique, lower case, never one that passes for staff", async () => {
    await setFlag(true);
    expect((await (await as(a)).claimUsernameAction(`@${uname("a").toUpperCase()}`))).toEqual({ ok: true, username: uname("a") });
    expect((await (await as(b)).claimUsernameAction(uname("b"))).ok).toBe(true);
    expect((await (await as(c)).claimUsernameAction(uname("c"))).ok).toBe(true);
    expect(await rpcError(d, "claim_username", { p_username: uname("a") })).toBe("username_taken");
    expect(await rpcError(d, "claim_username", { p_username: "Admin" })).toBe("username_reserved");
    expect(await rpcError(d, "claim_username", { p_username: "narrowgate_help" })).toBe("username_reserved");
    expect(await rpcError(d, "claim_username", { p_username: "a b" })).toBe("username_invalid");
    // A second change within 30 days is refused; the same name again is fine.
    expect(await rpcError(a, "claim_username", { p_username: uname("a") })).toBeNull();
    expect(await rpcError(a, "claim_username", { p_username: uname("a2") })).toBe("username_change_wait");
  });

  it("a member can't write their own Friends row, username or anyone's friendship directly", async () => {
    expect((await d.client.from("social_profiles").insert({ user_id: d.id, username: uname("d") })).error).not.toBeNull();
    expect((await a.client.from("social_profiles").update({ username: uname("zz") }).eq("user_id", a.id)).error).not.toBeNull();
    expect((await a.client.from("friendships").insert({ user_a: a.id < b.id ? a.id : b.id, user_b: a.id < b.id ? b.id : a.id })).error).not.toBeNull();
    expect((await a.client.from("friend_requests").insert({ sender_id: b.id, recipient_id: a.id })).error).not.toBeNull();
    expect((await a.client.from("friend_requests").insert({ sender_id: a.id, recipient_id: b.id })).error).not.toBeNull();
    expect((await a.client.from("user_blocks").insert({ blocker_id: b.id, blocked_id: a.id })).error).not.toBeNull();
    expect((await a.client.from("user_reports").insert({ reporter_id: a.id, reported_id: b.id, reason: "spam" })).error).not.toBeNull();
    expect((await svc.from("social_profiles").select("username").eq("user_id", a.id).single()).data?.username).toBe(uname("a"));
    expect(await friendsCount(a)).toBe(0);
  });

  it("search returns usernames only, needs three characters, and never the searcher", async () => {
    const hits = await search(a, `t${tag}`);
    expect(hits.map((h) => h.username).sort()).toEqual([uname("b"), uname("c")].sort());
    expect(Object.keys(hits[0]!).sort()).toEqual(["relation", "user_id", "username"]);
    expect(hits.every((h) => h.relation === "none")).toBe(true);
    expect(await search(a, "t")).toEqual([]);
    expect(await search(a, "%%%")).toEqual([]);
    // An underscore is a literal character, not a wildcard.
    expect(await search(a, `t${tag.slice(0, -1)}_`)).toEqual([]);
    // A member without a username isn't findable; a stranger gets no profile.
    expect((await search(a, "fr-d")).length).toBe(0);
    expect(await profileOf(a, b)).toBeNull();
    expect((await a.client.from("social_profiles").select("user_id").neq("user_id", a.id)).data).toEqual([]);
    expect((await a.client.from("profiles").select("id").eq("id", b.id)).data).toEqual([]);
  });

  it("a request shares nothing until it is accepted; duplicates are refused", async () => {
    expect(await (await as(a)).sendFriendRequestAction(b.id)).toEqual({ ok: true, status: "requested" });
    expect(await rpcError(a, "send_friend_request", { p_user_id: b.id })).toBe("already_requested");
    expect(await rpcError(a, "send_friend_request", { p_user_id: a.id })).toBe("self_request");
    expect(await rpcError(a, "send_friend_request", { p_user_id: d.id })).toBe("user_not_found");
    expect(await rpcError(d, "send_friend_request", { p_user_id: a.id })).toBe("username_required");
    expect(await profileOf(a, b)).toBeNull();
    expect(await profileOf(b, a)).toBeNull();
    const bo = await overview(b);
    expect(bo.incoming!.map((r) => r.username)).toEqual([uname("a")]);
    expect((await overview(a)).outgoing!.map((r) => r.user_id)).toEqual([b.id]);
    expect((await search(a, uname("b")))[0]?.relation).toBe("requested");
    expect((await search(b, uname("a")))[0]?.relation).toBe("incoming");
    // Only the recipient can answer it.
    const id = bo.incoming![0]!.request_id!;
    expect(await rpcError(a, "respond_friend_request", { p_request_id: id, p_accept: true })).toBe("request_not_found");
    expect(await rpcError(c, "respond_friend_request", { p_request_id: id, p_accept: true })).toBe("request_not_found");
    expect(await friendsCount(a)).toBe(0);
    expect((await (await as(b)).respondFriendRequestAction(id, true)).ok).toBe(true);
    expect(await friendsCount(a)).toBe(1);
    expect(await rpcError(a, "send_friend_request", { p_user_id: b.id })).toBe("already_friends");
    expect(await rpcError(b, "respond_friend_request", { p_request_id: id, p_accept: true })).toBe("request_not_found");
  });

  it("a brand-new friend sees the username and name only: becoming a friend shares no activity by itself", async () => {
    // B never touched a switch: these are the column defaults (migration 078).
    expect((await svc.from("social_profiles").select("searchable, profile_visible, show_workouts, show_records, show_body, show_nutrition, show_faith").eq("user_id", b.id).single()).data).toEqual({
      searchable: true,
      profile_visible: true,
      show_workouts: false,
      show_records: false,
      show_body: false,
      show_nutrition: false,
      show_faith: false,
    });
    // B has two completed workouts, and A, now a friend, sees none of it.
    const p = await profileOf(a, b);
    expect(Object.keys(p!).sort()).toEqual(["display_name", "profile_visible", "since", "user_id", "username"]);
    expect(p).toMatchObject({ user_id: b.id, username: uname("b"), display_name: "Bea Private-Name", profile_visible: true });
    // The same in the other direction.
    expect(Object.keys((await profileOf(b, a))!).sort()).toEqual(["display_name", "profile_visible", "since", "user_id", "username"]);
  });

  it("a friend sees the name and the training numbers the other shares, and nothing else", async () => {
    // B switches workouts on (off by default).
    expect((await (await as(b)).updatePrivacyAction({ key: "show_workouts", value: true })).ok).toBe(true);
    // B trained today and yesterday (UTC). On a Monday, yesterday falls in the previous week: a two-week streak.
    const weeksExpected = new Date().getUTCDay() === 1 ? 2 : 1;
    const p = await profileOf(a, b);
    expect(p).toMatchObject({ user_id: b.id, username: uname("b"), display_name: "Bea Private-Name", profile_visible: true, workouts_last_7_days: 2, streak_days: 2, streak_weeks: weeksExpected });
    expect(Object.keys(p!).sort()).toEqual(["display_name", "profile_visible", "since", "streak_days", "streak_weeks", "user_id", "username", "workouts_last_7_days"]);
    // Still no direct access to B's rows.
    expect((await a.client.from("workout_sessions").select("id").eq("user_id", b.id)).data).toEqual([]);
    expect((await a.client.from("social_profiles").select("user_id").eq("user_id", b.id)).data).toEqual([]);
    // A third member, not a friend, gets nothing.
    expect(await profileOf(c, b)).toBeNull();
  });

  it("switching sharing off takes effect at once; a member changes only their own switches", async () => {
    expect((await (await as(b)).updatePrivacyAction({ key: "show_workouts", value: false })).ok).toBe(true);
    let p = await profileOf(a, b);
    expect(p).not.toHaveProperty("workouts_last_7_days");
    expect(p).not.toHaveProperty("streak_days");
    expect((await (await as(b)).updatePrivacyAction({ key: "show_workouts", value: true })).ok).toBe(true);
    expect((await (await as(b)).updatePrivacyAction({ key: "profile_visible", value: false })).ok).toBe(true);
    p = await profileOf(a, b);
    expect(Object.keys(p!).sort()).toEqual(["display_name", "profile_visible", "since", "user_id", "username"]);
    expect((await (await as(b)).updatePrivacyAction({ key: "profile_visible", value: true })).ok).toBe(true);
    // A can't flip B's switches, and nobody sets an unknown one.
    await a.client.from("social_profiles").update({ show_body: true }).eq("user_id", b.id);
    expect((await svc.from("social_profiles").select("show_body").eq("user_id", b.id).single()).data?.show_body).toBe(false);
    expect((await (await as(a)).updatePrivacyAction({ key: "username" as never, value: true })).ok).toBe(false);
    // A switch that nothing reads yet can't be switched on ahead of time; switching it off is always allowed.
    for (const key of ["show_records", "show_in_leaderboards", "show_body", "show_nutrition", "show_faith"] as const) {
      expect(await (await as(b)).updatePrivacyAction({ key, value: true }), key).toEqual({ ok: false, error: "That setting isn't available yet." });
      expect((await (await as(b)).updatePrivacyAction({ key, value: false })).ok, key).toBe(true);
    }
    expect((await svc.from("social_profiles").select("show_records, show_body, show_nutrition, show_faith").eq("user_id", b.id).single()).data).toEqual({ show_records: false, show_body: false, show_nutrition: false, show_faith: false });
    // Turning search off hides a member from strangers, not from friends.
    expect((await (await as(b)).updatePrivacyAction({ key: "searchable", value: false })).ok).toBe(true);
    expect(await search(c, uname("b"))).toEqual([]);
    expect((await search(a, uname("b")))[0]?.relation).toBe("friend");
    expect((await (await as(b)).updatePrivacyAction({ key: "searchable", value: true })).ok).toBe(true);
  });

  it("a member who switched search off can't be sent a request, even by someone holding their account id, unless they asked first", async () => {
    const [hidden, seeker] = await Promise.all([createTestUser("fr-hid"), createTestUser("fr-seek")]);
    try {
      await hidden.client.rpc("claim_username", { p_username: uname("h") });
      await seeker.client.rpc("claim_username", { p_username: uname("s") });
      signedIn = hidden.client;
      expect((await (await actions()).updatePrivacyAction({ key: "searchable", value: false })).ok).toBe(true);
      expect(await search(seeker, uname("h"))).toEqual([]);
      expect(await rpcError(seeker, "send_friend_request", { p_user_id: hidden.id })).toBe("user_not_found");
      expect((await svc.from("friend_requests").select("id", { count: "exact", head: true }).eq("recipient_id", hidden.id)).count).toBe(0);
      // The hidden member reaches out; the other's request then meets it.
      expect((await hidden.client.rpc("send_friend_request", { p_user_id: seeker.id })).data).toBe("requested");
      expect((await seeker.client.rpc("send_friend_request", { p_user_id: hidden.id })).data).toBe("accepted");
      expect(await friendsCount(hidden)).toBe(1);
    } finally {
      await Promise.all([deleteTestUser(hidden), deleteTestUser(seeker)]);
    }
  });

  it("two requests that cross make a friendship; the sender isn't notified of a decline (but can infer it) and can't repeat it at once", async () => {
    expect((await a.client.rpc("send_friend_request", { p_user_id: c.id })).data).toBe("requested");
    const id = (await overview(c)).incoming![0]!.request_id!;
    expect((await (await as(c)).respondFriendRequestAction(id, false)).ok).toBe(true);
    expect(await friendsCount(c)).toBe(0);
    expect((await a.client.from("friend_requests").select("status").eq("id", id)).data).toEqual([]);
    expect((await overview(a)).outgoing).toEqual([]);
    // Not concealed: the cooldown tells the sender what happened (audit finding F-04).
    expect(await rpcError(a, "send_friend_request", { p_user_id: c.id })).toBe("request_cooldown");
    // C changes their mind and asks A; A's own request then meets it.
    expect((await c.client.rpc("send_friend_request", { p_user_id: a.id })).data).toBe("requested");
    await svc.from("friend_requests").delete().eq("id", id);
    expect((await a.client.rpc("send_friend_request", { p_user_id: c.id })).data).toBe("accepted");
    expect(await friendsCount(c)).toBe(1);
    expect((await svc.from("friend_requests").select("id", { count: "exact", head: true }).eq("status", "pending").or(`sender_id.eq.${c.id},recipient_id.eq.${c.id}`)).count).toBe(0);
  });

  it("a withdrawn request disappears for both", async () => {
    await (await as(d)).claimUsernameAction(uname("d"));
    expect((await b.client.rpc("send_friend_request", { p_user_id: d.id })).data).toBe("requested");
    const id = (await overview(d)).incoming![0]!.request_id!;
    expect(await rpcError(d, "cancel_friend_request", { p_request_id: id })).toBeNull();
    expect((await overview(d)).incoming!.length).toBe(1);
    expect((await (await as(b)).cancelFriendRequestAction(id)).ok).toBe(true);
    expect((await overview(d)).incoming).toEqual([]);
    expect(await rpcError(d, "respond_friend_request", { p_request_id: id, p_accept: true })).toBe("request_not_found");
  });

  it("invite links: single use, the inviter's own link is refused, and a used one says so", async () => {
    const created = await (await as(b)).createFriendInviteAction();
    if (!created.ok) throw new Error(created.error);
    expect(created.url.endsWith(`/friends/invite/${created.code}`)).toBe(true);
    expect((await d.client.from("friend_invites").select("code")).data).toEqual([]);
    expect(await rpcError(b, "accept_friend_invite", { p_code: created.code })).toBe("own_invite");
    expect(await rpcError(a, "accept_friend_invite", { p_code: created.code })).toBe("already_friends");
    const r = await (await as(d)).acceptFriendInviteAction(`${created.code.slice(0, 5)}-${created.code.slice(5).toLowerCase()}`);
    expect(r).toEqual({ ok: true, friendId: b.id });
    expect(await rpcError(c, "accept_friend_invite", { p_code: created.code })).toBe("invite_used");
    expect(await inviteOutcome(c, "ZZZZZZZZZZ")).toBe("not_found");
    await svc.from("friend_invites").update({ created_at: new Date(Date.now() - 9 * 86_400_000).toISOString(), expires_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), used_at: null }).eq("code", created.code);
    expect(await rpcError(c, "accept_friend_invite", { p_code: created.code })).toBe("invite_expired");
    // A member can't mint a code that never expires, or one for someone else.
    expect((await b.client.from("friend_invites").insert({ inviter_id: b.id, code: "ABCDEFGHJK", expires_at: "2099-01-01T00:00:00Z" })).error).not.toBeNull();
    expect((await b.client.from("friend_invites").insert({ inviter_id: a.id, code: "ABCDEFGHJK" })).error).not.toBeNull();
  });

  it("removing a friend stops sharing at once, for both", async () => {
    expect(await profileOf(d, b)).not.toBeNull();
    expect((await (await as(d)).removeFriendAction(b.id)).ok).toBe(true);
    expect(await profileOf(d, b)).toBeNull();
    expect(await profileOf(b, d)).toBeNull();
    // Removing someone else's friendship isn't possible: the function only ever uses the caller's own pair.
    await c.client.rpc("remove_friend", { p_user_id: b.id });
    expect(await profileOf(a, b)).not.toBeNull();
  });

  it("blocking ends the friendship and any request and hides each from the other; the blocked member isn't notified (but can infer it)", async () => {
    expect((await d.client.rpc("send_friend_request", { p_user_id: a.id })).data).toBe("requested");
    expect((await (await as(a)).blockUserAction(b.id)).ok).toBe(true);
    expect((await (await as(a)).blockUserAction(d.id)).ok).toBe(true);
    expect(await profileOf(a, b)).toBeNull();
    expect(await profileOf(b, a)).toBeNull();
    expect((await overview(a)).incoming).toEqual([]);
    expect(await search(b, uname("a"))).toEqual([]);
    expect(await search(a, uname("b"))).toEqual([]);
    // Nothing says "blocked": to the blocked member A now reads as "not found". That is not concealment: a member
    // they could see a moment ago has vanished, and they can work out why (audit finding F-03).
    expect(await rpcError(b, "send_friend_request", { p_user_id: a.id })).toBe("user_not_found");
    expect((await b.client.from("user_blocks").select("blocker_id")).data).toEqual([]);
    expect((await overview(a)).blocked!.map((x) => x.user_id).sort()).toEqual([b.id, d.id].sort());
    expect((await overview(b)).blocked).toEqual([]);
    // An invite link between them is refused the same way.
    const inv = await (await as(a)).createFriendInviteAction();
    if (!inv.ok) throw new Error(inv.error);
    expect(await inviteOutcome(b, inv.code)).toBe("not_found");
    // B can't lift A's block.
    await b.client.rpc("unblock_user", { p_user_id: a.id });
    await b.client.from("user_blocks").delete().eq("blocked_id", b.id);
    expect(await rpcError(b, "send_friend_request", { p_user_id: a.id })).toBe("user_not_found");
    // A unblocks: they can connect again, but aren't friends until a new request is accepted.
    expect((await (await as(a)).unblockUserAction(b.id)).ok).toBe(true);
    expect(await profileOf(a, b)).toBeNull();
    expect((await b.client.rpc("send_friend_request", { p_user_id: a.id })).data).toBe("requested");
  });

  it("accepting a request from a member with a block between them is refused, and no friendship is made", async () => {
    // A still blocks D. block_user closes pending requests, so one can only exist here if it is planted.
    const { data: planted, error } = await svc.from("friend_requests").insert({ sender_id: d.id, recipient_id: a.id }).select("id").single();
    if (error) throw error;
    const before = await friendsCount(a);
    expect(await rpcError(a, "respond_friend_request", { p_request_id: planted!.id, p_accept: true })).toBe("request_not_found");
    expect(await friendsCount(a)).toBe(before);
    expect(await profileOf(d, a)).toBeNull();
    // Declining it still works.
    expect(await rpcError(a, "respond_friend_request", { p_request_id: planted!.id, p_accept: false })).toBeNull();
    expect((await svc.from("friend_requests").select("status").eq("id", planted!.id).single()).data?.status).toBe("declined");
    await svc.from("friend_requests").delete().eq("id", planted!.id);
  });

  it("blocking also ends an accountability partnership between the two", async () => {
    const [x, y] = a.id < c.id ? [a.id, c.id] : [c.id, a.id];
    const { data: p, error } = await svc.from("accountability_partnerships").insert({ user_a: x, user_b: y }).select("id").single();
    if (error) throw error;
    await svc.from("accountability_shares").insert([{ partnership_id: p!.id, user_id: x }, { partnership_id: p!.id, user_id: y }]);
    expect((await (await as(c)).blockUserAction(a.id)).ok).toBe(true);
    expect((await svc.from("accountability_partnerships").select("status").eq("id", p!.id).single()).data?.status).toBe("ended");
    expect((await svc.from("accountability_shares").select("user_id", { count: "exact", head: true }).eq("partnership_id", p!.id)).count).toBe(0);
    expect(await friendsCount(c)).toBe(0);
  });

  it("reports reach administrators only, one open report per pair, a few a day", async () => {
    const r = await (await as(b)).reportUserAction({ userId: a.id, reason: "harassment", details: "  unkind messages  " });
    expect(r.ok).toBe(true);
    const first = (await b.client.from("user_reports").select("id, details, status")).data!;
    expect(first).toEqual([{ id: first[0]!.id, details: "unkind messages", status: "open" }]);
    expect((await b.client.rpc("report_user", { p_user_id: a.id, p_reason: "spam", p_details: null })).data).toBe(first[0]!.id);
    expect(await rpcError(b, "report_user", { p_user_id: a.id, p_reason: "because", p_details: null })).toBe("unknown_reason");
    expect(await rpcError(b, "report_user", { p_user_id: b.id, p_reason: "spam", p_details: null })).toBe("user_not_found");
    // The reported member and other members see nothing; they can't call the admin list either.
    expect((await a.client.from("user_reports").select("id")).data).toEqual([]);
    expect((await c.client.from("user_reports").select("id")).data).toEqual([]);
    expect((await a.client.rpc("admin_user_reports", { p_status: "open" })).error?.code).toBe("42501");
    // The reporter can't close or rewrite it.
    await b.client.from("user_reports").update({ status: "dismissed" }).eq("id", first[0]!.id);
    expect((await svc.from("user_reports").select("status, reviewed_at").eq("id", first[0]!.id).single()).data).toEqual({ status: "open", reviewed_at: null });
    // There is no administrators' note for a reporter to read (removed in migration 077).
    expect((await b.client.from("user_reports").select("admin_note")).error).not.toBeNull();
    const listed = ((await admin.client.rpc("admin_user_reports", { p_status: "open" })).data ?? []) as { id: string; reporter_username: string; reported_username: string; open_reports_against: number }[];
    expect(listed.find((x) => x.id === first[0]!.id)).toMatchObject({ reporter_username: uname("b"), reported_username: uname("a"), open_reports_against: 1 });
    expect((await admin.client.from("user_reports").update({ status: "actioned", reviewed_at: new Date().toISOString() }).eq("id", first[0]!.id).select("id")).data?.length).toBe(1);
    // Five in 24 hours, then refused.
    const others = [c, d, admin];
    for (const o of others) expect(await rpcError(b, "report_user", { p_user_id: o.id, p_reason: "spam", p_details: null })).toBeNull();
    expect(await rpcError(b, "report_user", { p_user_id: a.id, p_reason: "spam", p_details: null })).toBeNull();
    const extra = await createTestUser("fr-e");
    try {
      expect(await rpcError(b, "report_user", { p_user_id: extra.id, p_reason: "spam", p_details: null })).toBe("report_limit");
    } finally {
      await deleteTestUser(extra);
    }
  });

  it("the database itself limits searches and invite-code attempts, whatever calls it", async () => {
    const probe = await createTestUser("fr-probe");
    try {
      await probe.client.rpc("claim_username", { p_username: uname("p") });
      let found = 0;
      for (let i = 0; i < 70; i++) found += (await search(probe, uname("c"))).length;
      // 60 searches a minute are answered; the rest return nothing.
      expect(found).toBe(60);
      const outcomes: string[] = [];
      for (let i = 0; i < 22; i++) outcomes.push(await inviteOutcome(probe, "ZZZZZZZZZZ"));
      expect(outcomes.slice(0, 20).every((e) => e === "not_found")).toBe(true);
      expect(outcomes.slice(20)).toEqual(["invite_rate_limited", "invite_rate_limited"]);
    } finally {
      await deleteTestUser(probe);
    }
  });

  it("a visitor who isn't signed in can do none of it", async () => {
    const { anonClient } = await import("./helpers");
    const anon = anonClient();
    for (const [fn, args] of [
      ["search_users", { p_query: uname("a") }],
      ["friends_overview", {}],
      ["friend_profile", { p_user_id: b.id }],
      ["send_friend_request", { p_user_id: b.id }],
      ["block_user", { p_user_id: b.id }],
      ["claim_username", { p_username: "visitor_1" }],
    ] as const) {
      const { data, error } = await anon.rpc(fn, args);
      expect(error?.code, fn).toBe("42501");
      expect(data).toBeNull();
    }
    // Not only zero rows: the signed-out role holds no privilege on these tables at all (migration 078).
    for (const table of ["social_profiles", "friend_requests", "friendships", "user_blocks", "user_reports", "friend_invites", "accountability_partnerships", "accountability_invites", "accountability_shares", "accountability_nudges"]) {
      const res = await anon.from(table).select("*").limit(1);
      expect(res.error?.code, table).toBe("42501");
      expect(res.data ?? [], table).toEqual([]);
    }
    // The two invite tables used to let the signed-out role ask for a delete (row-level security then matched no row).
    for (const table of ["friend_invites", "accountability_invites"]) {
      expect((await anon.from(table).delete().eq("id", crypto.randomUUID())).error?.code, table).toBe("42501");
    }
    // A visitor still reads the feature flags (the app needs them) but can't write one.
    expect((await anon.from("feature_flags").select("key").eq("key", FLAG)).data).toEqual([{ key: FLAG }]);
    expect((await anon.from("feature_flags").update({ enabled: true }).eq("key", FLAG)).error?.code).toBe("42501");
    expect((await anon.from("feature_flags").insert({ key: `visitor_${tag}`, enabled: true })).error?.code).toBe("42501");
  });

  it("with the flag switched off again, nothing is shared, but removing and blocking still work", async () => {
    // Make B and D friends first.
    expect((await b.client.rpc("send_friend_request", { p_user_id: d.id })).data).toBe("requested");
    const id = (await overview(d)).incoming![0]!.request_id!;
    expect(await rpcError(d, "respond_friend_request", { p_request_id: id, p_accept: true })).toBeNull();
    expect(await profileOf(d, b)).not.toBeNull();
    await setFlag(false);
    expect(await profileOf(d, b)).toBeNull();
    expect(await search(d, uname("b"))).toEqual([]);
    expect((await (await as(d)).updatePrivacyAction({ key: "show_body", value: true }))).toEqual({ ok: false, error: "Friends isn't available right now." });
    expect((await (await as(d)).updatePrivacyAction({ key: "show_workouts", value: false })).ok).toBe(true);
    expect((await (await as(d)).removeFriendAction(b.id)).ok).toBe(true);
    expect(await friendsCount(d)).toBe(0);
    expect((await (await as(d)).blockUserAction(b.id)).ok).toBe(true);
    await setFlag(true);
  });

  it("deleting an account removes its username, friendships, requests, blocks and reports", async () => {
    const gone = await createTestUser("fr-gone");
    await gone.client.rpc("claim_username", { p_username: uname("gone") });
    await gone.client.rpc("send_friend_request", { p_user_id: c.id });
    const inc = (await overview(c)).incoming!.find((r) => r.user_id === gone.id)!;
    await c.client.rpc("respond_friend_request", { p_request_id: inc.request_id, p_accept: true });
    await gone.client.rpc("block_user", { p_user_id: d.id });
    await gone.client.rpc("report_user", { p_user_id: d.id, p_reason: "spam", p_details: null });
    expect((await overview(c)).friends!.some((f) => f.user_id === gone.id)).toBe(true);
    await deleteTestUser(gone);
    expect((await overview(c)).friends!.some((f) => f.user_id === gone.id)).toBe(false);
    for (const [table, cols] of [["social_profiles", ["user_id"]], ["friendships", ["user_a", "user_b"]], ["friend_requests", ["sender_id", "recipient_id"]], ["user_blocks", ["blocker_id", "blocked_id"]], ["user_reports", ["reporter_id", "reported_id"]]] as const) {
      for (const col of cols) expect((await svc.from(table).select(col, { count: "exact", head: true }).eq(col, gone.id)).count, `${table}.${col}`).toBe(0);
    }
    // The username is free again.
    expect(await rpcError(admin, "claim_username", { p_username: uname("gone") })).toBeNull();
  });
});
