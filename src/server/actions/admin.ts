"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { actionError, actionInvalid, actionOk, type ActionState } from "@/lib/action-state";
import { adminCategorySchema, adminContentSchema, adminExerciseSchema, adminProgramSchema } from "@/lib/validation/schemas";
import { MOVEMENT_PATTERNS } from "@/lib/domain/types";
import { requireAdmin } from "@/server/auth";
import { isServiceRoleConfigured } from "@/server/env";
import { logError } from "@/server/log";

const uuid = z.string().uuid();
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const csv = (s: string) =>
  s
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

async function audit(actorId: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  if (!isServiceRoleConfigured()) {
    logError("admin.audit", new Error("Service role not configured; audit entry not written"), { action });
    return;
  }
  const { error } = await getServiceSupabase().from("admin_audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
  if (error) logError("admin.audit", error);
}

export async function saveExerciseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const parsed = adminExerciseSchema.safeParse({
    ...Object.fromEntries(formData),
    isPublished: formData.get("isPublished") === "on",
    isTimed: formData.get("isTimed") === "on",
  });
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  if (!(MOVEMENT_PATTERNS as readonly string[]).includes(v.movementPattern)) return actionError("Unknown movement pattern.", { movementPattern: "Invalid" });
  const row = {
    slug: v.slug,
    name: v.name,
    category: v.category,
    movement_pattern: v.movementPattern,
    difficulty: v.difficulty,
    description: v.description,
    primary_muscles: csv(v.primaryMuscles),
    equipment: csv(v.equipment),
    instructions: lines(v.instructions),
    form_cues: lines(v.formCues),
    common_mistakes: lines(v.commonMistakes),
    is_published: v.isPublished,
    is_timed: v.isTimed,
  };
  const supabase = await getServerSupabase();
  const id = uuid.safeParse(formData.get("id"));
  const { data, error } = id.success
    ? await supabase.from("exercises").update(row).eq("id", id.data).select("id").single()
    : await supabase.from("exercises").insert(row).select("id").single();
  if (error) return actionError(error.code === "23505" ? "That slug is already used." : "Couldn't save the exercise.");
  await audit(user.id, id.success ? "exercise.update" : "exercise.create", "exercise", data.id as string, { slug: v.slug });
  revalidatePath("/admin/exercises");
  return actionOk("Exercise saved.");
}

export async function addExerciseMediaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const parsed = z
    .object({
      exerciseId: uuid,
      mediaType: z.enum(["image", "video"]),
      externalUrl: z.string().trim().url().startsWith("https://"),
      license: z.string().trim().min(2).max(200),
      attribution: z.string().trim().max(200).optional().default(""),
      altText: z.string().trim().min(3).max(200),
      confirm: z.literal("on", { message: "Confirm you have the right to use this media" }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("exercise_media")
    .insert({ exercise_id: v.exerciseId, media_type: v.mediaType, external_url: v.externalUrl, license: v.license, attribution: v.attribution || null, alt_text: v.altText })
    .select("id")
    .single();
  if (error) return actionError("Couldn't add media.");
  await audit(user.id, "exercise_media.create", "exercise_media", data.id as string, { exerciseId: v.exerciseId, license: v.license });
  revalidatePath("/admin/exercises");
  return actionOk("Media added.");
}

export async function deleteExerciseMediaAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("exercise_media").delete().eq("id", id.data);
  await audit(user.id, "exercise_media.delete", "exercise_media", id.data);
  revalidatePath("/admin/exercises");
}

export async function saveProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return actionError("Invalid program.");
  const parsed = adminProgramSchema.safeParse({
    ...Object.fromEntries(formData),
    isPublished: formData.get("isPublished") === "on",
    categoryId: formData.get("categoryId") || null,
  });
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("training_programs")
    .update({ name: v.name, summary: v.summary, description: v.description, tier: v.tier, is_published: v.isPublished, category_id: v.categoryId })
    .eq("id", id.data)
    .is("owner_id", null);
  if (error) return actionError("Couldn't save the program.");
  await audit(user.id, "program.update", "training_program", id.data, { tier: v.tier, published: v.isPublished });
  revalidatePath("/admin/programs");
  revalidatePath("/train");
  return actionOk("Program saved.");
}

export async function saveProgramExerciseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const parsed = z
    .object({
      id: uuid,
      sets: z.coerce.number().int().min(1).max(20),
      reps: z.string().trim().max(20),
      durationSeconds: z.preprocess((x) => (x === "" ? null : x), z.coerce.number().int().min(5).max(7200).nullable()),
      restSeconds: z.coerce.number().int().min(0).max(900),
      rpe: z.preprocess((x) => (x === "" ? null : x), z.coerce.number().min(1).max(10).nullable()),
      notes: z.string().trim().max(500),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  if (!v.reps && !v.durationSeconds) return actionError("Enter reps or a duration.");
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("program_exercises")
    .update({ sets: v.sets, reps: v.reps || null, duration_seconds: v.durationSeconds, rest_seconds: v.restSeconds, rpe: v.rpe, notes: v.notes || null })
    .eq("id", v.id);
  if (error) return actionError("Couldn't save. Only curated programs can be edited here.");
  await audit(user.id, "program_exercise.update", "program_exercise", v.id);
  return actionOk("Saved.");
}

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const parsed = adminCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();
  const id = uuid.safeParse(formData.get("id"));
  const row = { slug: v.slug, name: v.name, description: v.description, sort_order: v.sortOrder };
  const { data, error } = id.success
    ? await supabase.from("program_categories").update(row).eq("id", id.data).select("id").single()
    : await supabase.from("program_categories").insert(row).select("id").single();
  if (error) return actionError(error.code === "23505" ? "That slug is already used." : "Couldn't save the category.");
  await audit(user.id, id.success ? "category.update" : "category.create", "program_category", data.id as string, { slug: v.slug });
  revalidatePath("/admin/categories");
  return actionOk("Category saved.");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("program_categories").delete().eq("id", id.data);
  await audit(user.id, "category.delete", "program_category", id.data);
  revalidatePath("/admin/categories");
}

export async function saveContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  const parsed = adminContentSchema.safeParse({ ...Object.fromEntries(formData), isPublished: formData.get("isPublished") === "on" });
  if (!parsed.success) return actionInvalid(parsed.error);
  const v = parsed.data;
  const supabase = await getServerSupabase();
  const id = uuid.safeParse(formData.get("id"));
  const row = { kind: v.kind, title: v.title, body: v.body, scripture_ref: v.scriptureRef || null, is_published: v.isPublished, published_at: v.isPublished ? new Date().toISOString() : null };
  const { data, error } = id.success
    ? await supabase.from("content_items").update(row).eq("id", id.data).select("id").single()
    : await supabase.from("content_items").insert(row).select("id").single();
  if (error) return actionError("Couldn't save the content.");
  await audit(user.id, id.success ? "content.update" : "content.create", "content_item", data.id as string, { kind: v.kind, published: v.isPublished });
  revalidatePath("/admin/content");
  return actionOk("Content saved.");
}

export async function deleteContentAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await getServerSupabase();
  await supabase.from("content_items").delete().eq("id", id.data);
  await audit(user.id, "content.delete", "content_item", id.data);
  revalidatePath("/admin/content");
}

export async function toggleFlagAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const key = z.string().regex(/^[a-z0-9_]+$/).safeParse(formData.get("key"));
  if (!key.success) return;
  const enabled = formData.get("enabled") === "true";
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("feature_flags").update({ enabled }).eq("key", key.data);
  if (!error) await audit(user.id, "flag.update", "feature_flag", key.data, { enabled });
  revalidatePath("/admin/flags");
}
