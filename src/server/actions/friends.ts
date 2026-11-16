"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  friendInviteShareText,
  friendsErrorMessage,
  generateInviteCode,
  inviteUrl,
  isPrivacyKey,
  isReportReason,
  MAX_OPEN_FRIEND_INVITES,
  normalizeInviteCode,
  normalizeSearch,
  normalizeUsername,
  parseSearch,
  REPORT_DETAILS_MAX,
  usernameProblem,
  type PrivacyKey,
  type SearchHit,
} from "@/lib/domain/friends";
import { publicEnv } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { FRIENDS_FLAG, isFlagOn } from "@/server/flags";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";

/**
 * Friends (migration 076). Everything that connects two members is refused while the `friends_challenges` flag is off
 * (the database refuses too). Removing, blocking, unblocking, reporting, declining and withdrawing always work, and so
 * does switching a privacy setting off. Available to every signed-in member (Free and Pro alike).
 */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const PAGE = "/friends";
const OFF = "Friends isn't available right now.";
const BUSY = "You're doing that a lot. Please wait a minute and try again.";
const uuid = z.string().uuid();

async function signedInAndOn() {
  const user = await requireUser();
  return { user, on: await isFlagOn(FRIENDS_FLAG) };
}

function failure(scope: string, error: { message?: string; code?: string }, fallback: string): { ok: false; error: string } {
  const known = friendsErrorMessage(error.message);
  if (known) return { ok: false, error: known };
  logError(scope, error);
  return { ok: false, error: fallback };
}

/** Choose or change my username. */
export async function claimUsernameAction(input: string): Promise<Result<{ username: string }>> {
  const { user, on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  const name = normalizeUsername(typeof input === "string" ? input : "");
  const problem = usernameProblem(name);
  if (problem) return { ok: false, error: problem };
  if (!(await rateLimit(`friends-username:${user.id}`, 10, 10 * 60_000)).ok) return { ok: false, error: BUSY };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("claim_username", { p_username: name });
  if (error) return failure("friends.username", error, "Couldn't save that username. Please try again.");
  revalidatePath(PAGE, "layout");
  return { ok: true, username: data as string };
}

/** Find members whose username starts with what I typed. Usernames only. */
export async function searchUsersAction(input: string): Promise<Result<{ hits: SearchHit[] }>> {
  const { user, on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  const q = normalizeSearch(typeof input === "string" ? input : "");
  if (!q) return { ok: true, hits: [] };
  // Slows down anyone trying to list every username.
  if (!(await rateLimit(`friends-search:${user.id}`, 30, 60_000)).ok) return { ok: false, error: BUSY };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("search_users", { p_query: q });
  if (error) return failure("friends.search", error, "Search didn't work. Please try again.");
  return { ok: true, hits: parseSearch(data) };
}

export async function sendFriendRequestAction(userId: string): Promise<Result<{ status: "requested" | "accepted" }>> {
  const { on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  if (!uuid.safeParse(userId).success) return { ok: false, error: "That member wasn't found." };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("send_friend_request", { p_user_id: userId });
  if (error) return failure("friends.request", error, "Couldn't send the request. Please try again.");
  revalidatePath(PAGE, "layout");
  return { ok: true, status: data === "accepted" ? "accepted" : "requested" };
}

export async function respondFriendRequestAction(requestId: string, accept: boolean): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(requestId).success || typeof accept !== "boolean") return { ok: false, error: "That request is no longer open." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("respond_friend_request", { p_request_id: requestId, p_accept: accept });
  if (error) return failure("friends.respond", error, "Couldn't save your answer. Please try again.");
  revalidatePath(PAGE, "layout");
  return { ok: true };
}

export async function cancelFriendRequestAction(requestId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "That request is no longer open." };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("cancel_friend_request", { p_request_id: requestId });
  if (error) return failure("friends.cancel", error, "Couldn't withdraw the request. Please try again.");
  if (data !== true) return { ok: false, error: "That request is no longer open." };
  revalidatePath(PAGE, "layout");
  return { ok: true };
}

export async function removeFriendAction(userId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(userId).success) return { ok: false, error: "That member wasn't found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("remove_friend", { p_user_id: userId });
  if (error) return failure("friends.remove", error, "Couldn't remove this friend. Please try again.");
  revalidatePath(PAGE, "layout");
  return { ok: true };
}

export async function blockUserAction(userId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(userId).success) return { ok: false, error: "That member wasn't found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("block_user", { p_user_id: userId });
  if (error) return failure("friends.block", error, "Couldn't block this member. Please try again.");
  revalidatePath(PAGE, "layout");
  revalidatePath("/profile/accountability");
  return { ok: true };
}

export async function unblockUserAction(userId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(userId).success) return { ok: false, error: "That member wasn't found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("unblock_user", { p_user_id: userId });
  if (error) return failure("friends.unblock", error, "Couldn't unblock this member. Please try again.");
  revalidatePath(PAGE, "layout");
  return { ok: true };
}

const reportSchema = z.object({ userId: uuid, reason: z.string(), details: z.string().max(REPORT_DETAILS_MAX).optional(), block: z.boolean().optional() });

/** Report a member to the administrators, and optionally block them in the same step. */
export async function reportUserAction(input: { userId: string; reason: string; details?: string; block?: boolean }): Promise<Result> {
  await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success || !isReportReason(parsed.data.reason)) return { ok: false, error: "Choose a reason." };
  const { userId, reason, details, block } = parsed.data;
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("report_user", { p_user_id: userId, p_reason: reason, p_details: details ?? null });
  if (error) return failure("friends.report", error, "Couldn't send the report. Please try again.");
  if (block) {
    const blocked = await supabase.rpc("block_user", { p_user_id: userId });
    if (blocked.error) return failure("friends.block", blocked.error, "Your report was sent, but blocking didn't work. Please try blocking again.");
  }
  revalidatePath(PAGE, "layout");
  return { ok: true };
}

/** Turn one of my privacy switches on or off. Takes effect at once. */
export async function updatePrivacyAction(input: { key: PrivacyKey; value: boolean }): Promise<Result> {
  const user = await requireUser();
  if (!input || typeof input.key !== "string" || !isPrivacyKey(input.key) || typeof input.value !== "boolean") return { ok: false, error: "Invalid setting." };
  // Sharing less always works, even if the feature has been switched off since; sharing more needs the flag.
  if (input.value && !(await isFlagOn(FRIENDS_FLAG))) return { ok: false, error: OFF };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("social_profiles")
    .update({ [input.key]: input.value })
    .eq("user_id", user.id)
    .select("user_id");
  if (error) return failure("friends.privacy", error, "Couldn't save that setting. Please try again.");
  if (!data?.length) return { ok: false, error: "Choose a username first." };
  revalidatePath(PAGE, "layout");
  return { ok: true };
}

/** A new single-use invite link (valid 7 days) and the text to send with it. */
export async function createFriendInviteAction(): Promise<Result<{ code: string; expiresAt: string; url: string; shareText: string }>> {
  const { user, on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  const supabase = await getServerSupabase();
  const [{ count }, { data: me }] = await Promise.all([
    supabase.from("friend_invites").select("id", { count: "exact", head: true }).eq("inviter_id", user.id).is("used_at", null).gt("expires_at", new Date().toISOString()),
    supabase.from("social_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!me) return { ok: false, error: "Choose a username first." };
  if ((count ?? 0) >= MAX_OPEN_FRIEND_INVITES) return { ok: false, error: `You have ${MAX_OPEN_FRIEND_INVITES} unused invite links. Withdraw one, or wait for a friend to use one.` };
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase.from("friend_invites").insert({ inviter_id: user.id, code }).select("code, expires_at").single();
    if (!error && data) {
      revalidatePath(PAGE);
      const url = inviteUrl(publicEnv.siteUrl, data.code as string);
      return { ok: true, code: data.code as string, expiresAt: data.expires_at as string, url, shareText: friendInviteShareText(url, data.expires_at as string) };
    }
    if (error?.code !== "23505") return failure("friends.invite", error ?? {}, "Couldn't create an invite link. Please try again.");
  }
  return { ok: false, error: "Couldn't create an invite link. Please try again." };
}

export async function withdrawFriendInviteAction(inviteId: string): Promise<Result> {
  const user = await requireUser();
  if (!uuid.safeParse(inviteId).success) return { ok: false, error: "That invite wasn't found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("friend_invites").delete().eq("id", inviteId).eq("inviter_id", user.id);
  if (error) return failure("friends.withdraw", error, "Couldn't withdraw the invite. Please try again.");
  revalidatePath(PAGE);
  return { ok: true };
}

/** Use a friend's invite link or code: you become friends at once. */
export async function acceptFriendInviteAction(input: string): Promise<Result<{ friendId: string }>> {
  const { user, on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  const code = normalizeInviteCode(typeof input === "string" ? input : "");
  if (!code) return { ok: false, error: "That invite link isn't complete. Ask your friend to send it again." };
  // Slows down guessing codes.
  if (!(await rateLimit(`friends-invite:${user.id}`, 10, 10 * 60_000)).ok) return { ok: false, error: BUSY };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("accept_friend_invite", { p_code: code });
  if (error) return failure("friends.accept", error, "Couldn't add your friend. Please try again.");
  revalidatePath(PAGE, "layout");
  return { ok: true, friendId: data as string };
}
