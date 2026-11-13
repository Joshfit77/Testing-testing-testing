import type { NextRequest } from "next/server";
import { isListedProgram } from "@/data/program-retirements";
import { canAccessTier, planFromEntitlement } from "@/lib/domain/plans";
import type { Plan } from "@/lib/domain/types";
import { authenticateRequest } from "@/server/api-auth";
import { apiError, apiOk } from "@/server/api-response";

export const dynamic = "force-dynamic";

/** GET /api/v1/programs — library programs with a `locked` flag for the caller's plan. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return apiError(401, auth.error);
  const [{ data: programs, error }, { data: ent }] = await Promise.all([
    auth.supabase.from("training_programs").select("id, slug, name, summary, difficulty, duration_weeks, days_per_week, session_minutes, tier").eq("is_published", true).order("name"),
    auth.supabase.from("user_entitlements").select("plan, valid_until").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  if (error) return apiError(500, "server_error");
  const plan = planFromEntitlement(ent as { plan: string; valid_until: string | null } | null);
  // Retired programs stay published for the members who started them but aren't listed (as in the app).
  return apiOk((programs ?? []).filter((p) => isListedProgram(p.slug)).map((p) => ({ ...p, locked: !canAccessTier(plan, p.tier as Plan) })));
}
