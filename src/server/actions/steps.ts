"use server";

import { z } from "zod";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { formatSteps, MAX_DAILY_STEPS, MAX_SYNC_DAYS, STEP_GOAL_MAX, STEP_GOAL_MIN, STEP_SOURCE_LABELS } from "@/lib/domain/steps";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
/** Blank form fields become "missing" rather than 0. */
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const stepCount = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ error: "Enter a number of steps" })
    .int("Use a whole number")
  .min(0, "Steps can't be negative")
    .max(MAX_DAILY_STEPS, `That's more than ${formatSteps(MAX_DAILY_STEPS)} steps`),
);

/**
 * No revalidatePath here: step data only appears on dynamic pages (Home, Progress) that the client
 * router doesn't cache, and the caller refreshes the current route after a successful save.
 * Re-rendering Home inside the action response intermittently left the form stuck "Saving…"
 * (seen in Playwright against `next start`), while a separate router.refresh() is reliable.
 */

async function stepsCtx() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const today = isoDateInTz(new Date(), profile?.timezone || "UTC");
  return { user, today, supabase: await getServerSupabase() };
}

const manualSchema = z.object({ day: isoDate, steps: stepCount });

/** Enter or overwrite one day's steps by hand. */
export async function saveStepsManualAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, today, supabase } = await stepsCtx();
  const parsed = manualSchema.safeParse({ day: formData.get("day") || today, steps: formData.get("steps") });
  if (!parsed.success) return actionInvalid(parsed.error);
  const { day, steps } = parsed.data;
  if (day > today) return actionError("You can't log steps for a future day.", { day: "Pick today or an earlier day" });
  if (day < addDays(today, -365)) return actionError("That day is too far back.", { day: "Pick a day within the last year" });
  const { error } = await supabase
    .from("daily_steps")
    .upsert({ user_id: user.id, day, steps, source: "manual" }, { onConflict: "user_id,day" });
  if (error) {
    logError("steps.manual", error);
    return actionError("Couldn't save your steps. Please try again.");
  }
  return actionOk(`${formatSteps(steps)} steps saved for ${day === today ? "today" : day}.`);
}

const syncSchema = z.object({
  source: z.enum(["apple_health", "health_connect"]),
  days: z
    .array(z.object({ day: isoDate, steps: stepCount }))
    .min(1, "Nothing to sync")
    .max(MAX_SYNC_DAYS, `Sync at most ${MAX_SYNC_DAYS} days at a time`)
    .refine((ds) => new Set(ds.map((d) => d.day)).size === ds.length, "Each day may appear once"),
});

/** Save step counts read from Apple Health or Health Connect on the device. */
export async function syncStepsAction(input: unknown): Promise<ActionState> {
  const { user, today, supabase } = await stepsCtx();
  const parsed = syncSchema.safeParse(input);
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "Invalid step data.");
  const { source, days } = parsed.data;
  // The phone may be a day ahead of the profile's time zone; allow one day of slack.
  const latest = addDays(today, 1);
  const earliest = addDays(today, -MAX_SYNC_DAYS);
  if (days.some((d) => d.day > latest || d.day < earliest)) return actionError("Some synced days are outside the last month.");
  const { error } = await supabase.from("daily_steps").upsert(
    days.map((d) => ({ user_id: user.id, day: d.day, steps: d.steps, source })),
    { onConflict: "user_id,day" },
  );
  if (error) {
    logError("steps.sync", error);
    return actionError("Couldn't save your synced steps. Please try again.");
  }
  return actionOk(`Synced ${days.length} ${days.length === 1 ? "day" : "days"} from ${STEP_SOURCE_LABELS[source]}.`);
}

const goalSchema = z.object({
  stepGoal: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "Enter a number" })
      .int("Use a whole number")
      .min(STEP_GOAL_MIN, `Set a goal of at least ${formatSteps(STEP_GOAL_MIN)}`)
      .max(STEP_GOAL_MAX, `Keep your goal at or under ${formatSteps(STEP_GOAL_MAX)}`),
  ),
});

export async function updateStepGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, supabase } = await stepsCtx();
  const parsed = goalSchema.safeParse({ stepGoal: formData.get("stepGoal") });
  if (!parsed.success) return actionInvalid(parsed.error);
  const { error } = await supabase.from("profiles").update({ step_goal: parsed.data.stepGoal }).eq("id", user.id);
  if (error) {
    logError("steps.goal", error);
    return actionError("Couldn't update your step goal. Please try again.");
  }
  return actionOk(`Daily step goal set to ${formatSteps(parsed.data.stepGoal)}.`);
}
