import "server-only";
import { cache } from "react";
import { getServerSupabase } from "@/lib/supabase/server";

/** Feature flags are publicly readable; missing flags default to enabled so a fresh DB still works. */
export const getFlags = cache(async (): Promise<Record<string, boolean>> => {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase.from("feature_flags").select("key, enabled");
    return Object.fromEntries((data ?? []).map((f) => [f.key as string, Boolean(f.enabled)]));
  } catch {
    return {};
  }
});

export async function isFlagEnabled(key: string): Promise<boolean> {
  const flags = await getFlags();
  return flags[key] ?? true;
}

/** TestFlight "Was this coaching advice useful?" under coach replies (migration 050): collects new data, so strict. */
export const COACH_FEEDBACK_FLAG = "coach_feedback";

/**
 * For features that must stay off until the owner turns them on (e.g. anything that collects new data): on only when
 * the flag exists and is enabled. A missing flag, or flags that can't be read, mean off.
 */
export async function isFlagOn(key: string): Promise<boolean> {
  const flags = await getFlags();
  return flags[key] === true;
}
