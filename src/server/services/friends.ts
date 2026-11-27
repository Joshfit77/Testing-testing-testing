import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRIVACY, parseFriendProfile, parseOverview, PRIVACY_KEYS, type FriendProfile, type FriendsOverview, type PrivacySettings } from "@/lib/domain/friends";

export interface MySocialProfile {
  username: string;
  usernameChangedAt: string;
  privacy: PrivacySettings;
}

export interface OpenFriendInvite {
  id: string;
  code: string;
  expiresAt: string;
}

/** My own Friends row (username and privacy switches), or null when I haven't chosen a username yet. */
export async function getMySocialProfile(supabase: SupabaseClient, userId: string): Promise<MySocialProfile | null> {
  const { data, error } = await supabase
    .from("social_profiles")
    .select(`username, username_changed_at, ${PRIVACY_KEYS.join(", ")}`)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  const privacy = { ...DEFAULT_PRIVACY };
  for (const k of PRIVACY_KEYS) if (typeof row[k] === "boolean") privacy[k] = row[k] as boolean;
  return { username: row.username as string, usernameChangedAt: row.username_changed_at as string, privacy };
}

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [], blocked: [] };

/**
 * The Friends screen, read with the member's own session: friends, requests and blocks come from friends_overview()
 * (the only way a member's name reaches another member), invites from the member's own rows.
 */
export async function getFriendsData(supabase: SupabaseClient, userId: string): Promise<{ overview: FriendsOverview; invites: OpenFriendInvite[] }> {
  const [overviewRes, invitesRes] = await Promise.all([
    supabase.rpc("friends_overview"),
    supabase
      .from("friend_invites")
      .select("id, code, expires_at")
      .eq("inviter_id", userId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (overviewRes.error) throw overviewRes.error;
  if (invitesRes.error) throw invitesRes.error;
  return {
    overview: parseOverview(overviewRes.data) ?? EMPTY,
    invites: ((invitesRes.data ?? []) as { id: string; code: string; expires_at: string }[]).map((i) => ({ id: i.id, code: i.code, expiresAt: i.expires_at })),
  };
}

/** What one friend lets me see, or null when we aren't friends (any more). */
export async function getFriendProfile(supabase: SupabaseClient, friendId: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase.rpc("friend_profile", { p_user_id: friendId });
  if (error) throw error;
  return parseFriendProfile(data);
}
