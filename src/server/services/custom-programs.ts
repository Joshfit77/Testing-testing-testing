import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCustomProgram, type CustomProgramInput } from "@/lib/domain/custom-programs";
import { loadExercises, toCatalog } from "@/server/services/catalog";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";

/**
 * Build a custom program from validated input, save it as the user's private program and make it the
 * active one. Shared by the program builder (/train/build) and the end of onboarding.
 */
export async function buildAndActivateCustomProgram(
  supabase: SupabaseClient,
  userId: string,
  input: CustomProgramInput,
  source: "custom" | "starter" = "custom",
): Promise<{ programId: string; name: string }> {
  const catalog = toCatalog(await loadExercises(supabase));
  const seed = buildCustomProgram(input, catalog);
  const programId = await createPrivateProgram(supabase, userId, seed, source);
  await activateProgram(supabase, userId, programId);
  return { programId, name: seed.name };
}
