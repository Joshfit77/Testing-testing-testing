import type { NextRequest } from "next/server";
import { getPlans } from "@/lib/domain/plans";
import { getAiAllowance } from "@/server/services/ai-coach";
import type { Plan } from "@/lib/domain/types";
import { authenticateRequest } from "@/server/api-auth";
import { apiError, apiOk } from "@/server/api-response";

export const dynamic = "force-dynamic";

/** GET /api/v1/me — profile, plan and feature entitlements for the authenticated user. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return apiError(401, auth.error);
  const [{ data: profile }, { data: ent }] = await Promise.all([
    auth.supabase.from("profiles").select("display_name, unit_system, timezone, faith_enabled, onboarding_completed_at").eq("id", auth.user.id).single(),
    auth.supabase.from("user_entitlements").select("plan, valid_until").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  const expired = ent?.valid_until ? new Date(ent.valid_until as string).getTime() < Date.now() : false;
  const plan: Plan = !ent || expired ? "free" : ((ent.plan as Plan) ?? "free");
  const config = getPlans()[plan];
  const ai = await getAiAllowance(auth.user.id, plan);
  return apiOk({ id: auth.user.id, email: auth.user.email, profile, plan, features: config.features, aiMonthlyLimit: ai.chatLimit });
}
