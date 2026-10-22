import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/server/log";
import { normalizeTemplateGroups, type TemplateExercise, type TemplateInput } from "@/lib/domain/workout-templates";

export class TemplateError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "invalid" | "db" = "db",
  ) {
    super(message);
    this.name = "TemplateError";
  }
}

export interface TemplateSummary {
  id: string;
  name: string;
  notes: string | null;
  updatedAt: string;
  exercises: (TemplateExercise & { slug: string; name: string; isTimed: boolean })[];
}

const TEMPLATE_SELECT =
  "id, name, notes, updated_at, items:workout_template_exercises(position, sets, target, reps, duration_seconds, distance_m, rest_seconds, superset_group, notes, exercise:exercises(id, slug, name, is_timed))";

type Row = {
  id: string;
  name: string;
  notes: string | null;
  updated_at: string;
  items: {
    position: number;
    sets: number;
    target: TemplateExercise["target"];
    reps: string | null;
    duration_seconds: number | null;
    distance_m: number | string | null;
    rest_seconds: number;
    superset_group: number | null;
    notes: string | null;
    exercise: { id: string; slug: string; name: string; is_timed: boolean } | null;
  }[];
};

function toSummary(r: Row): TemplateSummary {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    updatedAt: r.updated_at,
    exercises: [...r.items]
      .sort((a, b) => a.position - b.position)
      .filter((i) => i.exercise)
      .map((i) => ({
        exerciseId: i.exercise!.id,
        slug: i.exercise!.slug,
        name: i.exercise!.name,
        isTimed: i.exercise!.is_timed,
        sets: i.sets,
        target: i.target,
        reps: i.reps,
        durationSeconds: i.duration_seconds,
        distanceM: i.distance_m == null ? null : Number(i.distance_m),
        restSeconds: i.rest_seconds,
        supersetGroup: i.superset_group,
        notes: i.notes,
      })),
  };
}

export async function listTemplates(supabase: SupabaseClient, userId: string): Promise<TemplateSummary[]> {
  const { data, error } = await supabase.from("workout_templates").select(TEMPLATE_SELECT).eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw new TemplateError(error.message);
  return ((data ?? []) as unknown as Row[]).map(toSummary);
}

export async function getTemplate(supabase: SupabaseClient, userId: string, id: string): Promise<TemplateSummary | null> {
  const { data, error } = await supabase.from("workout_templates").select(TEMPLATE_SELECT).eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new TemplateError(error.message);
  return data ? toSummary(data as unknown as Row) : null;
}

async function writeItems(supabase: SupabaseClient, userId: string, templateId: string, exercises: TemplateExercise[]) {
  const items = normalizeTemplateGroups(exercises).map((e, position) => ({
    template_id: templateId,
    user_id: userId,
    exercise_id: e.exerciseId,
    position,
    sets: e.sets,
    target: e.target,
    reps: e.target === "reps" ? e.reps : null,
    duration_seconds: e.target === "time" ? e.durationSeconds : null,
    distance_m: e.target === "distance" ? e.distanceM : null,
    rest_seconds: e.restSeconds,
    superset_group: e.supersetGroup,
    notes: e.notes || null,
  }));
  const { error } = await supabase.from("workout_template_exercises").insert(items);
  if (error) throw new TemplateError(error.message, error.code === "23503" || error.code === "23514" ? "invalid" : "db");
}

export async function createTemplate(supabase: SupabaseClient, userId: string, input: TemplateInput): Promise<string> {
  const { data, error } = await supabase.from("workout_templates").insert({ user_id: userId, name: input.name, notes: input.notes }).select("id").single();
  if (error || !data) throw new TemplateError(error?.message ?? "Insert failed");
  try {
    await writeItems(supabase, userId, data.id as string, input.exercises);
  } catch (err) {
    await supabase.from("workout_templates").delete().eq("id", data.id).eq("user_id", userId);
    throw err;
  }
  return data.id as string;
}

/** Replace a template's name, notes and exercises. */
export async function updateTemplate(supabase: SupabaseClient, userId: string, id: string, input: TemplateInput): Promise<void> {
  const { data, error } = await supabase.from("workout_templates").update({ name: input.name, notes: input.notes }).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  if (error) throw new TemplateError(error.message);
  if (!data) throw new TemplateError("Template not found", "not_found");
  // Each position is unique, so the old exercises go first; if writing the new ones fails they're put back, so a
  // failed save never leaves the template empty.
  const { data: oldItems, error: readErr } = await supabase.from("workout_template_exercises").select("*").eq("template_id", id).eq("user_id", userId);
  if (readErr) throw new TemplateError(readErr.message);
  const { error: delErr } = await supabase.from("workout_template_exercises").delete().eq("template_id", id).eq("user_id", userId);
  if (delErr) throw new TemplateError(delErr.message);
  try {
    await writeItems(supabase, userId, id, input.exercises);
  } catch (err) {
    await supabase.from("workout_template_exercises").delete().eq("template_id", id).eq("user_id", userId);
    if (oldItems?.length) {
      const { error: restoreErr } = await supabase.from("workout_template_exercises").insert(oldItems);
      if (restoreErr) logError("templates.restore", restoreErr, { template: id });
    }
    throw err;
  }
}

export async function deleteTemplate(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error, count } = await supabase.from("workout_templates").delete({ count: "exact" }).eq("id", id).eq("user_id", userId);
  if (error) throw new TemplateError(error.message);
  if (!count) throw new TemplateError("Template not found", "not_found");
}
