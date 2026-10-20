import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityKind, ActivityLike, ActivitySource } from "@/lib/domain/activities";

export interface ActivityRow extends ActivityLike {
  timezone: string;
  notes: string | null;
  perceived_effort: number | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

/** Columns the app reads. Routes and splits are left out of lists (they can be large). */
const COLUMNS = "id, kind, source, started_at, timezone, distance_m, elapsed_s, moving_s, notes, perceived_effort, is_private, created_at, updated_at";

type Raw = Omit<ActivityRow, "distance_m"> & { distance_m: number | string | null };

/** PostgREST returns numeric columns as strings; normalise them. */
function normalise(r: Raw): ActivityRow {
  return { ...r, kind: r.kind as ActivityKind, source: r.source as ActivitySource, distance_m: r.distance_m == null ? null : Number(r.distance_m) };
}

/** Live (not deleted) activities, newest first. `before` pages by start time. */
export async function listActivities(
  supabase: SupabaseClient,
  userId: string,
  opts: { limit?: number; before?: string; since?: string } = {},
): Promise<ActivityRow[]> {
  let q = supabase.from("activities").select(COLUMNS).eq("user_id", userId).is("deleted_at", null);
  if (opts.before) q = q.lt("started_at", opts.before);
  if (opts.since) q = q.gte("started_at", opts.since);
  const { data, error } = await q.order("started_at", { ascending: false }).limit(opts.limit ?? 200);
  if (error) throw error;
  return ((data ?? []) as Raw[]).map(normalise);
}

/** One live activity owned by the user, or null. */
export async function getActivity(supabase: SupabaseClient, userId: string, id: string): Promise<ActivityRow | null> {
  const { data, error } = await supabase.from("activities").select(COLUMNS).eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data ? normalise(data as Raw) : null;
}

/** Every live run, for personal bests (summary columns only). */
export async function listRunsForRecords(supabase: SupabaseClient, userId: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("kind", "run")
    .is("deleted_at", null)
    .order("started_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return ((data ?? []) as Raw[]).map(normalise);
}
