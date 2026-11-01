import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { buildCustomProgram, type CustomProgramInput } from "@/lib/domain/custom-programs";
import { loadExercises, toCatalog } from "@/server/services/catalog";
import { activateProgram, createPrivateProgram } from "@/server/services/programs";

/**
 * Build a custom program from validated input, save it as the user's private program and make it the
 * active one. Shared by the program builder (/train/build) and the end of onboarding.
 *
 * A starter program (onboarding, schedule rebuild: every plan) is written with the service role for the signed-in
 * member, because the database lets members create only the paid kinds themselves
 * (supabase/migrations/20261101000047_program_builder_enforcement.sql). `userId` must be the session's user.
 */
export async function buildAndActivateCustomProgram(
  supabase: SupabaseClient,
  userId: string,
  input: CustomProgramInput,
  source: "custom" | "starter" = "custom",
): Promise<{ programId: string; name: string }> {
  const catalog = toCatalog(await loadExercises(supabase));
  const seed = buildCustomProgram(input, catalog);
  const programId = await createPrivateProgram(source === "starter" ? getServiceSupabase() : supabase, userId, seed, source);
  await activateProgram(supabase, userId, programId);
  return { programId, name: seed.name };
}
