import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { MemoryManager } from "@/components/coach/memory-manager";
import { getServerSupabase } from "@/lib/supabase/server";
import type { CoachMemory } from "@/lib/coach/memory";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getAiAllowance } from "@/server/services/ai-coach";

export const metadata = { title: "Coaching memory" };

export default async function CoachMemoryPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [allowance, { data: profile }, { data: memories }] = await Promise.all([
    getAiAllowance(user.id, await getUserPlan(user.id)),
    supabase.from("profiles").select("coach_memory_enabled, coach_memory_consent_at, wellness_consent_at").eq("id", user.id).maybeSingle(),
    supabase.from("coach_memories").select("id, category, content, source, created_at, updated_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/coach">AI Coach</BackLink>
      <PageHeader
        eyebrow="AI Coach"
        title="Coaching memory"
        description="Notes the coach keeps between conversations, so you don't have to repeat yourself. You decide what's saved."
      />
      <MemoryManager
        entitled={allowance.chatLimit > 0}
        enabled={Boolean(profile?.coach_memory_enabled)}
        consentAt={(profile?.coach_memory_consent_at as string | null) ?? null}
        wellnessConsent={Boolean(profile?.wellness_consent_at)}
        memories={(memories ?? []) as CoachMemory[]}
      />
    </div>
  );
}
