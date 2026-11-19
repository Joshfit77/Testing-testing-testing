import "server-only";
import { cache } from "react";
import { getServerSupabase } from "@/lib/supabase/server";

export interface FlagState {
  flags: Record<string, boolean>;
  /** False when the flags table couldn't be read (a database error or an exception), as opposed to an empty table. */
  readable: boolean;
}

/** Feature flags as read for this request, with whether the read worked. Pure, so the rules below are unit-tested. */
export function flagStateFrom(result: { data: { key: unknown; enabled: unknown }[] | null; error: unknown }): FlagState {
  if (result.error || !result.data) return { flags: {}, readable: false };
  return { flags: Object.fromEntries(result.data.map((f) => [f.key as string, Boolean(f.enabled)])), readable: true };
}

export const getFlagState = cache(async (): Promise<FlagState> => {
  try {
    const supabase = await getServerSupabase();
    return flagStateFrom(await supabase.from("feature_flags").select("key, enabled"));
  } catch {
    return { flags: {}, readable: false };
  }
});

/** Feature flags are publicly readable; missing flags default to enabled so a fresh DB still works. */
export const getFlags = cache(async (): Promise<Record<string, boolean>> => (await getFlagState()).flags);

/**
 * Kill switches that must fail closed. Every AI feature (coach chat, plan generation, meal plans, food photos, label
 * and product explanations, the weekly report and the Bible study helper) passes one of these. When the flags can't be
 * read, the owner can't be sure a switched-off AI is still off, so these count as off until the read works again. A
 * flag row that is simply missing still counts as on, as before, so a fresh database keeps working.
 */
export const FAIL_CLOSED_FLAGS: ReadonlySet<string> = new Set(["ai_coach", "ai_plan_generation"]);

/** The rule itself (pure, unit-tested): missing means on; unreadable means off for fail-closed flags only. */
export function flagEnabledIn(state: FlagState, key: string): boolean {
  if (!state.readable && FAIL_CLOSED_FLAGS.has(key)) return false;
  return state.flags[key] ?? true;
}

export async function isFlagEnabled(key: string): Promise<boolean> {
  return flagEnabledIn(await getFlagState(), key);
}

/** TestFlight "Was this coaching advice useful?" under coach replies (migration 050): collects new data, so strict. */
export const COACH_FEEDBACK_FLAG = "coach_feedback";

/** Accountability partners (migration 067): shares data with another member, so strict (off until the owner approves). */
export const ACCOUNTABILITY_FLAG = "accountability_partners";

/**
 * For features that must stay off until the owner turns them on (e.g. anything that collects new data): on only when
 * the flag exists and is enabled. A missing flag, or flags that can't be read, mean off.
 */
export async function isFlagOn(key: string): Promise<boolean> {
  const flags = await getFlags();
  return flags[key] === true;
}
