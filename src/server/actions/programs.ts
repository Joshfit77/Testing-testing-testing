"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { canAccessTier } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { getUserPlan, requireUser } from "@/server/auth";
import { activateProgram } from "@/server/services/programs";
import { logError } from "@/server/log";

const idSchema = z.string().uuid();

async function loadAccessibleProgram(programId: string) {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  const { data: program } = await supabase.from("training_programs").select("id, slug, tier, owner_id").eq("id", programId).maybeSingle();
  if (!program) return { user, supabase, program: null, allowed: false };
  const plan = await getUserPlan(user.id);
  // Private programs are always free for their owner; library programs are gated by tier.
  const allowed = program.owner_id === user.id || canAccessTier(plan, program.tier as Plan);
  return { user, supabase, program, allowed };
}

export async function saveProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formData.get("programId"));
  if (!parsed.success) return actionError("Invalid program.");
  const { user, supabase, program, allowed } = await loadAccessibleProgram(parsed.data);
  if (!program) return actionError("Program not found.");
  if (!allowed) return actionError("This program requires an upgraded plan.");
  const { error } = await supabase
    .from("user_programs")
    .upsert({ user_id: user.id, program_id: program.id, status: "saved" }, { onConflict: "user_id,program_id", ignoreDuplicates: true });
  if (error) {
    logError("programs.save", error);
    return actionError("Couldn't save the program. Please try again.");
  }
  revalidatePath("/train");
  return actionOk("Saved to your programs.");
}

export async function startProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = idSchema.safeParse(formData.get("programId"));
  if (!parsed.success) return actionError("Invalid program.");
  const { user, supabase, program, allowed } = await loadAccessibleProgram(parsed.data);
  if (!program) return actionError("Program not found.");
  if (!allowed) return actionError("This program requires an upgraded plan.");
  try {
    await activateProgram(supabase, user.id, program.id as string, { restart: formData.get("restart") === "1" });
  } catch (err) {
    logError("programs.start", err);
    return actionError("Couldn't start the program. Please try again.");
  }
  revalidatePath("/", "layout");
  redirect("/home");
}

export async function removeSavedProgramAction(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("userProgramId"));
  if (!parsed.success) return;
  const user = await requireUser();
  const supabase = await getServerSupabase();
  await supabase.from("user_programs").delete().eq("id", parsed.data).eq("user_id", user.id).neq("status", "active");
  revalidatePath("/train");
}

export async function pauseActiveProgramAction(): Promise<void> {
  const user = await requireUser();
  const supabase = await getServerSupabase();
  await supabase.from("user_programs").update({ status: "paused" }).eq("user_id", user.id).eq("status", "active");
  revalidatePath("/", "layout");
}
