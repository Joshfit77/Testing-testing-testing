import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SHARES, isNudgeKey, nudgesRemaining, parseSummary, type NudgeKey, type PartnerSummary, type ShareSettings } from "@/lib/domain/accountability";

export interface PartnerView {
  id: string;
  since: string;
  summary: PartnerSummary;
  /** What I share with this partner. */
  myShares: ShareSettings;
  /** Encouragements this partner sent me in the last 14 days, newest first. */
  received: { id: string; key: NudgeKey; at: string }[];
  /** Encouragements I can still send this partner now. */
  nudgesLeft: number;
}

export interface OpenInvite {
  id: string;
  code: string;
  expiresAt: string;
}

/**
 * The accountability page, read with the member's own session (RLS applies): active partnerships they are in, what
 * each partner shares (through accountability_summary only), their own share switches, recent encouragements and
 * their open invite codes.
 */
export async function getAccountabilityData(supabase: SupabaseClient, userId: string): Promise<{ partners: PartnerView[]; invites: OpenInvite[] }> {
  const now = new Date();
  const [partnershipsRes, invitesRes] = await Promise.all([
    supabase.from("accountability_partnerships").select("id, created_at").eq("status", "active").or(`user_a.eq.${userId},user_b.eq.${userId}`).order("created_at"),
    supabase
      .from("accountability_invites")
      .select("id, code, expires_at")
      .eq("inviter_id", userId)
      .is("used_at", null)
      .gt("expires_at", now.toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (partnershipsRes.error) throw partnershipsRes.error;
  if (invitesRes.error) throw invitesRes.error;
  const partnerships = (partnershipsRes.data ?? []) as { id: string; created_at: string }[];
  const invites = ((invitesRes.data ?? []) as { id: string; code: string; expires_at: string }[]).map((i) => ({ id: i.id, code: i.code, expiresAt: i.expires_at }));
  if (!partnerships.length) return { partners: [], invites };

  const ids = partnerships.map((p) => p.id);
  const fortnight = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [sharesRes, nudgesRes, summaries] = await Promise.all([
    supabase.from("accountability_shares").select("partnership_id, share_workouts, share_streak, share_program_progress").eq("user_id", userId).in("partnership_id", ids),
    supabase
      .from("accountability_nudges")
      .select("id, partnership_id, sender_id, message_key, created_at")
      .in("partnership_id", ids)
      .gte("created_at", fortnight)
      .order("created_at", { ascending: false })
      .limit(200),
    Promise.all(ids.map((id) => supabase.rpc("accountability_summary", { p_partnership_id: id }))),
  ]);
  if (sharesRes.error) throw sharesRes.error;
  if (nudgesRes.error) throw nudgesRes.error;
  const shares = new Map(((sharesRes.data ?? []) as (ShareSettings & { partnership_id: string })[]).map((s) => [s.partnership_id, s]));
  const nudges = (nudgesRes.data ?? []) as { id: string; partnership_id: string; sender_id: string; message_key: string; created_at: string }[];

  const partners: PartnerView[] = [];
  partnerships.forEach((p, i) => {
    const summary = parseSummary(summaries[i]?.data);
    // Null when the partnership ended (or the feature was switched off) between the two reads.
    if (!summary) return;
    const mine = shares.get(p.id);
    const here = nudges.filter((n) => n.partnership_id === p.id);
    partners.push({
      id: p.id,
      since: p.created_at,
      summary,
      myShares: mine
        ? { share_workouts: mine.share_workouts, share_streak: mine.share_streak, share_program_progress: mine.share_program_progress }
        : { ...DEFAULT_SHARES },
      received: here
        .filter((n) => n.sender_id !== userId && isNudgeKey(n.message_key))
        .slice(0, 10)
        .map((n) => ({ id: n.id, key: n.message_key as NudgeKey, at: n.created_at })),
      nudgesLeft: nudgesRemaining(
        here.filter((n) => n.sender_id === userId).map((n) => n.created_at),
        now,
      ),
    });
  });
  return { partners, invites };
}
