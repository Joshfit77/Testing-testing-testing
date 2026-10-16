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
