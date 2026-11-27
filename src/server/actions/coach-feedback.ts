"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { COACH_FEEDBACK_FLAG, isFlagOn } from "@/server/flags";
import { logError } from "@/server/log";

/** TestFlight feedback on one coach reply (migration 050). Off unless the `coach_feedback` flag is on. */
const feedbackSchema = z
  .object({
    messageId: z.string().uuid(),
    rating: z.enum(["yes", "partially", "no"]).nullable(),
    comment: z.string().trim().max(1000).optional().default(""),
    safetyConcern: z.boolean().default(false),
  })
  .refine((f) => f.rating !== null || f.safetyConcern, { message: "Choose an answer or report a concern." });

type CoachFeedbackInput = z.input<typeof feedbackSchema>;
type Result = { ok: true } | { ok: false; error: string };

export async function submitCoachFeedbackAction(input: CoachFeedbackInput): Promise<Result> {
  const user = await requireUser();
  // Collecting feedback is new data: nothing is stored unless the owner has switched it on.
  if (!(await isFlagOn(COACH_FEEDBACK_FLAG))) return { ok: false, error: "Feedback isn't being collected right now." };
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback." };
  const f = parsed.data;
  const supabase = await getServerSupabase();
  const { data: existing } = await supabase.from("ai_message_feedback").select("rating, safety_concern").eq("user_id", user.id).eq("message_id", f.messageId).maybeSingle();
  // A rating and a safety report can be sent separately; neither undoes the other.
  const row = {
    user_id: user.id,
    message_id: f.messageId,
    rating: f.rating ?? (existing?.rating as string | null) ?? null,
    comment: f.comment || null,
    safety_concern: f.safetyConcern || Boolean(existing?.safety_concern),
  };
  const { error } = await supabase.from("ai_message_feedback").upsert(row, { onConflict: "user_id,message_id" });
  if (error) {
    // The database only accepts feedback on the member's own coach replies (RLS).
    if (error.code === "42501") return { ok: false, error: "That reply wasn't found." };
    logError("coach.feedback", error);
    return { ok: false, error: "Couldn't send your feedback. Please try again." };
  }
  return { ok: true };
}
