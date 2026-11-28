import "server-only";
import { notFound } from "next/navigation";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { isFlagEnabled } from "@/server/flags";
import { isAiConfigured } from "@/server/env";
import { isDemoMode } from "@/server/demo";
import { biblicalAiFlagOn, biblicalAiRemaining } from "@/server/services/biblical-ai";

/**
 * What a Biblical AI page needs: the member, their plan and limits, and whether questions can be asked now. When the
 * `biblical_ai` flag is off every Biblical AI page is "not found", so nothing of it shows until the owner turns it on.
 */
export async function loadBiblicalAiAccess() {
  const { user, profile } = await requireOnboardedUser();
  if (!(await biblicalAiFlagOn())) notFound();
  const plan = await getUserPlan(user.id);
  const [remaining, aiOn] = await Promise.all([biblicalAiRemaining(user.id, plan), isFlagEnabled("ai_coach")]);
  return {
    user,
    profile,
    plan,
    limits: remaining.limits,
    remainingToday: Math.min(remaining.today, remaining.month),
    /** The AI kill switch is on and the server can call the provider (reading and word studies work regardless). */
    canAsk: aiOn && isAiConfigured() && !isDemoMode(),
    consented: Boolean(profile.ai_data_consent_at),
  };
}
