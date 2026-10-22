"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { templateSchema } from "@/lib/validation/schemas";
import { getPlans, hasFeature } from "@/lib/domain/plans";
import { getUserPlan, requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { createTemplate, deleteTemplate, TemplateError, updateTemplate } from "@/server/services/templates";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Hard ceiling for everyone (keeps lists usable); Free has a lower plan limit (`templateLimit`). */
const MAX_TEMPLATES = 100;

function message(err: unknown): string {
  if (err instanceof TemplateError && err.code === "not_found") return "That workout template no longer exists.";
  if (err instanceof TemplateError && err.code === "invalid") return "One of the exercises is no longer available.";
  return "We couldn't save your workout template. Please try again.";
}

/** Save a new workout template (from the template builder or "Save as template" after a workout). */
export async function createTemplateAction(input: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the workout and try again." };
  try {
    const supabase = await getServerSupabase();
    const [{ count }, plan] = await Promise.all([
      supabase.from("workout_templates").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      getUserPlan(user.id),
    ]);
    const limit = getPlans()[plan].templateLimit;
    if (!hasFeature(plan, "unlimited_templates") && limit !== null && (count ?? 0) >= limit) {
      // Templates saved earlier (e.g. before a downgrade) are kept; only new ones are limited.
      return { ok: false, error: `Free accounts can keep ${limit} workout templates. Delete one to save another, or upgrade to Plus for unlimited templates.` };
    }
    if ((count ?? 0) >= MAX_TEMPLATES) return { ok: false, error: `You can keep up to ${MAX_TEMPLATES} workout templates. Delete one to save another.` };
    const id = await createTemplate(supabase, user.id, parsed.data);
    return { ok: true, data: { id } };
  } catch (err) {
    logError("templates.create", err);
    return { ok: false, error: message(err) };
  }
}

export async function updateTemplateAction(id: unknown, input: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const tid = z.string().uuid().safeParse(id);
  const parsed = templateSchema.safeParse(input);
  if (!tid.success) return { ok: false, error: "Invalid template" };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the workout and try again." };
  try {
    const supabase = await getServerSupabase();
    await updateTemplate(supabase, user.id, tid.data, parsed.data);
    return { ok: true, data: { id: tid.data } };
  } catch (err) {
    logError("templates.update", err);
    return { ok: false, error: message(err) };
  }
}

/** For ActionButton (confirm, then router.refresh()). */
export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  try {
    const supabase = await getServerSupabase();
    await deleteTemplate(supabase, user.id, id.data);
  } catch (err) {
    logError("templates.delete", err);
  }
}
