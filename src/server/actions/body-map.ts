"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasFeature } from "@/lib/domain/plans";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireUser } from "@/server/auth";
import { logError } from "@/server/log";

type Result = { ok: true; message: string } | { ok: false; error: string };

/** Which strength table the muscle map compares with (Pro, and legacy Plus). Ranks are recomputed from the logs on the next view. */
export async function setStrengthStandardsAction(table: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = z.enum(["men", "women"]).safeParse(table);
  if (!parsed.success) return { ok: false, error: "Choose the men's or women's table." };
  if (!hasFeature(await getUserPlan(user.id), "advanced_analytics")) return { ok: false, error: "Strength ranks are included with Pro All Access." };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("profiles").update({ strength_standards: parsed.data }).eq("id", user.id);
  if (error) {
    logError("body_map.standards", error);
    return { ok: false, error: "Couldn't save that. Try again." };
  }
  revalidatePath("/progress/body-map");
  revalidatePath("/progress");
  return { ok: true, message: parsed.data === "men" ? "Comparing with the men's table." : "Comparing with the women's table." };
}
