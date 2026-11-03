"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth";
import { journeyPlan, validPlanSpec } from "@/server/bible/plans";
import { logError } from "@/server/log";

/*
 * Reading journeys. Each call goes to a database function that enforces the daily rule for the signed-in member
 * (migration 053); the member can't write journey rows directly.
 */

export type CheckInResult =
  | { ok: true; day: number; reading: boolean; prayer: boolean; source: "online" | "offline" }
  | { ok: false; code: "too_late" | "closed" | "no_journey" | "invalid" | "error"; error: string };

const ERRORS: Record<string, { code: Exclude<CheckInResult, { ok: true }>["code"]; error: string }> = {
  faith_offline_too_late: { code: "too_late", error: "This was saved on your device after its day had already closed, so it couldn't count. The rule closes each day at midnight (with a short allowance for a phone that was offline)." },
  faith_day_closed: { code: "closed", error: "That day isn't open for check-ins." },
  faith_no_journey: { code: "no_journey", error: "You don't have an active journey." },
  faith_invalid_time: { code: "invalid", error: "That time isn't valid." },
  faith_invalid_activity: { code: "invalid", error: "Unknown activity." },
};

function mapError(message: string | undefined): Exclude<CheckInResult, { ok: true }> {
  const key = Object.keys(ERRORS).find((k) => message?.includes(k));
  return { ok: false, ...(key ? ERRORS[key]! : { code: "error" as const, error: "Couldn't save. Check your connection and try again." }) };
}

/**
 * Mark today's Bible reading or prayer complete. occurredAt is when the member tapped it on a device that was offline;
 * the database decides whether that still counts (never silently for another day).
 */
export async function journeyCheckInAction(activity: "reading" | "prayer", occurredAt?: string | null): Promise<CheckInResult> {
  await requireUser();
  if (activity !== "reading" && activity !== "prayer") return mapError("faith_invalid_activity");
  const at = occurredAt ? z.string().datetime({ offset: true }).safeParse(occurredAt) : null;
  if (at && !at.success) return mapError("faith_invalid_time");
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("faith_journey_check_in", { p_activity: activity, p_occurred_at: at?.data ?? null });
  if (error) {
    if (!Object.keys(ERRORS).some((k) => error.message?.includes(k))) logError("faith.journey.checkin", error);
    return mapError(error.message);
  }
  const d = data as { day: number; reading: boolean; prayer: boolean; source: "online" | "offline" };
  return { ok: true, day: d.day, reading: d.reading, prayer: d.prayer, source: d.source };
}

/** Undo a mistaken tap (today only). */
export async function journeyUndoAction(activity: "reading" | "prayer"): Promise<{ ok: boolean }> {
  await requireUser();
  if (activity !== "reading" && activity !== "prayer") return { ok: false };
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("faith_journey_undo", { p_activity: activity });
  if (error) logError("faith.journey.undo", error);
  return { ok: !error };
}

const enrollSchema = z.object({
  kind: z.string().max(20),
  param: z.string().max(40).optional().nullable(),
  days: z.coerce.number().int(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accept: z.literal("on", { message: "Please confirm you understand the daily rule." }),
});

/** Start a journey. The plan must have enough Scripture for the duration; the database checks the dates. */
export async function enrollJourneyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = enrollSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Please check your choices.");
  const { kind, param, days, start } = parsed.data;
  const spec = validPlanSpec(kind, param ?? null);
  if (!spec || !journeyPlan(spec, days)) return actionError("That plan isn't available for this length. Choose another duration.");
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("faith_journey_enroll", { p_kind: spec.kind, p_param: spec.param ?? "", p_duration: days, p_start_on: start });
  if (error) {
    if (error.message?.includes("faith_invalid_start")) return actionError("Choose a start date from today up to 30 days ahead.");
    logError("faith.journey.enroll", error);
    return actionError("Couldn't start the journey. Please try again.");
  }
  redirect("/faith/journey?started=1");
}

/** End the active journey. Its days, attempts, notes and history are kept. */
export async function endJourneyAction(): Promise<void> {
  await requireUser();
  const supabase = await getServerSupabase();
  const { error } = await supabase.rpc("faith_journey_end");
  if (error) logError("faith.journey.end", error);
}
