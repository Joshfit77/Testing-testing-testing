import type { NextRequest } from "next/server";
import { getPlans } from "@/lib/domain/plans";
import { getAiAllowance } from "@/server/services/ai-coach";
import { authenticateRequest, planForAuth } from "@/server/api-auth";
import { apiError, apiOk } from "@/server/api-response";

export const dynamic = "force-dynamic";

/** GET /api/v1/me — profile, plan and feature entitlements for the authenticated user. */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return apiError(401, auth.error);
  const [{ data: profile }, plan] = await Promise.all([
    auth.supabase.from("profiles").select("display_name, unit_system, timezone, faith_enabled, onboarding_completed_at").eq("id", auth.user.id).single(),
    planForAuth(auth),
  ]);
  const config = getPlans()[plan];
  const ai = await getAiAllowance(auth.user.id, plan);
  return apiOk({ id: auth.user.id, email: auth.user.email, profile, plan, features: config.features, aiMonthlyLimit: ai.chatLimit });
}
