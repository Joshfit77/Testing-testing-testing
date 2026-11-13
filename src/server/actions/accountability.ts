"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accountabilityErrorMessage,
  generateInviteCode,
  inviteShareText,
  isNudgeKey,
  MAX_OPEN_INVITES,
  normalizeInviteCode,
  type ShareKey,
} from "@/lib/domain/accountability";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { ACCOUNTABILITY_FLAG, isFlagOn } from "@/server/flags";
import { logError } from "@/server/log";

/**
 * Accountability partners (migration 067). Every action except ending a partnership is refused while the
 * `accountability_partners` flag is off (the database refuses too). Available to every signed-in member.
 */
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const PAGE = "/profile/accountability";
const OFF = "Accountability partners aren't available right now.";
const uuid = z.string().uuid();

async function signedInAndOn() {
  const user = await requireUser();
  return { user, on: await isFlagOn(ACCOUNTABILITY_FLAG) };
}

function failure(scope: string, error: { message?: string; code?: string }, fallback: string): { ok: false; error: string } {
  const known = accountabilityErrorMessage(error.message);
  if (known) return { ok: false, error: known };
  logError(scope, error);
  return { ok: false, error: fallback };
}

/** A new single-use invite code (valid 7 days) and the text to send a friend with it. */
export async function createInviteAction(): Promise<Result<{ code: string; expiresAt: string; shareText: string }>> {
  const { user, on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  const supabase = await getServerSupabase();
  const { count } = await supabase
    .from("accountability_invites")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= MAX_OPEN_INVITES) return { ok: false, error: `You have ${MAX_OPEN_INVITES} unused codes. Withdraw one, or wait for a friend to use one.` };
  // A collision is astronomically unlikely (about 10^15 codes); retry once or twice anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { data, error } = await supabase.from("accountability_invites").insert({ inviter_id: user.id, code }).select("code, expires_at").single();
    if (!error && data) {
      revalidatePath(PAGE);
      return { ok: true, code: data.code as string, expiresAt: data.expires_at as string, shareText: inviteShareText(data.code as string, data.expires_at as string) };
    }
    if (error?.code !== "23505") return failure("accountability.invite", error ?? {}, "Couldn't create a code. Please try again.");
  }
  return { ok: false, error: "Couldn't create a code. Please try again." };
}

/** Withdraw one of my unused invite codes. */
export async function withdrawInviteAction(inviteId: string): Promise<Result> {
  const user = await requireUser();
  if (!uuid.safeParse(inviteId).success) return { ok: false, error: "That code wasn't found." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("accountability_invites").delete().eq("id", inviteId).eq("inviter_id", user.id);
  if (error) return failure("accountability.withdraw", error, "Couldn't withdraw the code. Please try again.");
  revalidatePath(PAGE);
  return { ok: true };
}

/** Enter a friend's code: you become partners (each of you then chooses what to share). */
export async function acceptInviteAction(input: string): Promise<Result<{ partnershipId: string }>> {
  const { on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  const code = normalizeInviteCode(typeof input === "string" ? input : "");
  if (!code) return { ok: false, error: "Codes are 10 letters and numbers, like ABCDE-FGH23." };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("accept_accountability_invite", { p_code: code });
  if (error) return failure("accountability.accept", error, "Couldn't add your partner. Please try again.");
  revalidatePath(PAGE);
  return { ok: true, partnershipId: data as string };
}

const shareSchema = z.object({
  partnershipId: uuid,
  key: z.enum(["share_workouts", "share_streak", "share_program_progress"]),
  value: z.boolean(),
});

/** Turn one of my share switches for one partner on or off. Takes effect at once. */
export async function updateShareAction(input: { partnershipId: string; key: ShareKey; value: boolean }): Promise<Result> {
  const user = await requireUser();
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid setting." };
  const { partnershipId, key, value } = parsed.data;
  // Turning sharing off always works, even if the feature has been switched off since; turning it on needs the flag.
  if (value && !(await isFlagOn(ACCOUNTABILITY_FLAG))) return { ok: false, error: OFF };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("accountability_shares")
    .update({ [key]: value })
    .eq("partnership_id", partnershipId)
    .eq("user_id", user.id)
    .select("partnership_id");
  if (error) return failure("accountability.share", error, "Couldn't save that setting. Please try again.");
  if (!data?.length) return { ok: false, error: "That partnership has ended." };
  revalidatePath(PAGE);
  return { ok: true };
}

/** End a partnership. Either member can, at any time (even with the feature off); sharing stops immediately. */
export async function endPartnershipAction(partnershipId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(partnershipId).success) return { ok: false, error: "That partnership wasn't found." };
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("end_accountability_partnership", { p_partnership_id: partnershipId });
  if (error) return failure("accountability.end", error, "Couldn't end the partnership. Please try again.");
  if (data !== true) return { ok: false, error: "That partnership wasn't found or has already ended." };
  revalidatePath(PAGE);
  return { ok: true };
}

/** Send one of the fixed encouragements (no free text). At most 3 per partner in any 24 hours. */
export async function sendNudgeAction(partnershipId: string, key: string): Promise<Result> {
  const { on } = await signedInAndOn();
  if (!on) return { ok: false, error: OFF };
  if (!uuid.safeParse(partnershipId).success || typeof key !== "string" || !isNudgeKey(key)) return { ok: false, error: "Choose one of the messages." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("send_accountability_nudge", { p_partnership_id: partnershipId, p_message_key: key });
  if (error) return failure("accountability.nudge", error, "Couldn't send that. Please try again.");
  revalidatePath(PAGE);
  return { ok: true };
}
