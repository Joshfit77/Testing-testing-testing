"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, type ActionState } from "@/lib/action-state";
import { isoDateInTz } from "@/lib/domain/dates";
import { buildCustomProgram, resolveGoalMaxes, resolveMaxes } from "@/lib/domain/custom-programs";
import { customProgramSchema, type CustomProgramFormInput } from "@/lib/validation/schemas";
import { requireOnboardedUser } from "@/server/auth";
import { loadExercises, toCatalog } from "@/server/services/catalog";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";
import { logError } from "@/server/log";

/** Durable per-user limit on how many custom programs can be built per hour. */
const BUILDS_PER_HOUR = 10;

/**
 * Build a personalized program from the /train/build answers, save it as a private program and
 * make it the active program. Available on every plan; custom programs are free for their owner.
 */
export async function buildCustomProgramAction(input: CustomProgramFormInput): Promise<ActionState> {
  const { user, profile } = await requireOnboardedUser();
  const parsed = customProgramSchema.safeParse(input);
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from("training_programs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("source", "custom")
    .gte("created_at", since);
  if ((count ?? 0) >= BUILDS_PER_HOUR) return actionError("You've built several programs in the last hour. Please try again a little later.");

  // Never trust client-computed maxes: recompute from the validated entries.
  const maxesKg = resolveMaxes(v.type, v.lifts);
  const goalMaxesKg = resolveGoalMaxes(v.type, v.goalLifts, maxesKg);

  try {
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ height_cm: v.heightCm, birth_year: new Date().getUTCFullYear() - v.age })
      .eq("id", user.id);
    if (pErr) throw pErr;

    const today = isoDateInTz(new Date(), profile.timezone ?? "UTC");
    const { error: wErr } = await supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, recorded_on: today, weight_kg: v.weightKg }, { onConflict: "user_id,recorded_on" });
    if (wErr) throw wErr;

    const catalog = toCatalog(await loadExercises(supabase));
    const seed = buildCustomProgram(
      {
        type: v.type,
        goal: v.goal,
        experience: v.experience,
        daysPerWeek: v.daysPerWeek,
        sessionMinutes: v.sessionMinutes,
        weeks: v.weeks,
        units: profile.unit_system,
        age: v.age,
        heightCm: v.heightCm,
        bodyweightKg: v.weightKg,
        maxesKg,
        goalMaxesKg,
        cardio: v.cardio ?? null,
        division: v.division ?? null,
        equipment: v.equipment,
      },
      catalog,
    );
    const programId = await createPrivateProgram(supabase, user.id, seed, "custom");
    await activateProgram(supabase, user.id, programId);
  } catch (err) {
    logError("custom-program.build", err, { type: v.type });
    return actionError("We couldn't build your program. Please try again.");
  }

  revalidatePath("/", "layout");
  redirect("/home?built=1");
}
