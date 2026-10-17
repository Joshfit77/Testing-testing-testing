import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgramSeed } from "@/data/programs";
import { expandProgram } from "@/lib/domain/program-expansion";

function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Persist a program definition as a PRIVATE program owned by the user (RLS: owner may write
 * their own unpublished programs). Used for onboarding starter programs and approved AI plans.
 * Returns the new program id.
 */
export async function createPrivateProgram(
  supabase: SupabaseClient,
  userId: string,
  seed: ProgramSeed,
  source: "starter" | "ai" | "custom",
): Promise<string> {
  const allDays = [...seed.days, ...(seed.weekTemplates ?? []).flatMap((w) => w.days)];
  const slugs = [...new Set(allDays.flatMap((d) => d.exercises.map((e) => e.ex)))];
  const { data: exRows, error: exErr } = await supabase.from("exercises").select("id, slug").in("slug", slugs);
  if (exErr) throw exErr;
  const idBySlug = new Map((exRows ?? []).map((r) => [r.slug as string, r.id as string]));
  const missing = slugs.filter((s) => !idBySlug.has(s));
  if (missing.length) throw new Error(`Unknown exercises: ${missing.join(", ")}`);

  const { data: category } = await supabase.from("program_categories").select("id").eq("slug", seed.category).maybeSingle();

  const { data: program, error: pErr } = await supabase
    .from("training_programs")
    .insert({
      slug: `${source}-${slugSuffix()}`,
      name: seed.name,
      summary: seed.summary,
      description: seed.description,
      category_id: category?.id ?? null,
      difficulty: seed.difficulty,
      duration_weeks: seed.weeks,
      days_per_week: seed.days.length,
      session_minutes: seed.sessionMinutes,
      goals: [...seed.goals, ...seed.types.map((t) => `type:${t}`)],
      equipment: seed.equipment,
      tier: "free",
      progression: seed.progression,
      warmup: seed.warmup,
      cooldown: seed.cooldown,
      low_impact: Boolean(seed.lowImpact),
      is_published: false,
      owner_id: userId,
      source,
    })
    .select("id")
    .single();
  if (pErr || !program) throw pErr ?? new Error("Program insert failed");

  try {
    const weeks = expandProgram(seed);
    const { data: weekRows, error: wErr } = await supabase
      .from("program_weeks")
      .insert(weeks.map((w) => ({ program_id: program.id, week_number: w.weekNumber, focus: w.focus, is_deload: w.isDeload })))
      .select("id, week_number");
    if (wErr) throw wErr;
    const weekId = new Map((weekRows ?? []).map((w) => [w.week_number as number, w.id as string]));

    const dayInserts = weeks.flatMap((w) =>
      w.days.map((d) => ({
        week_id: weekId.get(w.weekNumber)!,
        day_number: d.dayNumber,
        name: d.name,
        focus: d.focus,
        estimated_minutes: d.minutes,
        warmup: d.warmup,
        cooldown: d.cooldown,
      })),
    );
    const { data: dayRows, error: dErr } = await supabase.from("program_days").insert(dayInserts).select("id, week_id, day_number");
    if (dErr) throw dErr;
    const dayId = new Map((dayRows ?? []).map((d) => [`${d.week_id}:${d.day_number}`, d.id as string]));

    const exInserts = weeks.flatMap((w) =>
      w.days.flatMap((d) =>
        d.exercises.map((e) => ({
          day_id: dayId.get(`${weekId.get(w.weekNumber)}:${d.dayNumber}`)!,
          exercise_id: idBySlug.get(e.ex)!,
          position: e.position,
          sets: e.sets,
          reps: e.reps ?? null,
          duration_seconds: e.seconds ?? null,
          rest_seconds: e.rest,
          intensity: e.intensity ?? null,
          rpe: e.rpe ?? null,
          notes: e.notes ?? null,
        })),
      ),
    );
    if (exInserts.length) {
      const { error: peErr } = await supabase.from("program_exercises").insert(exInserts);
      if (peErr) throw peErr;
    }
  } catch (err) {
    // Roll back the partially-created program (children cascade).
    await supabase.from("training_programs").delete().eq("id", program.id);
    throw err;
  }
  return program.id as string;
}

/** Make a program the user's single active program (pausing any other active one). */
export async function activateProgram(supabase: SupabaseClient, userId: string, programId: string): Promise<string> {
  await supabase.from("user_programs").update({ status: "paused" }).eq("user_id", userId).eq("status", "active");
  const { data, error } = await supabase
    .from("user_programs")
    .upsert(
      { user_id: userId, program_id: programId, status: "active", current_week: 1, current_day: 1, started_at: new Date().toISOString(), completed_at: null },
      { onConflict: "user_id,program_id" },
    )
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not activate program");
  return data.id as string;
}
