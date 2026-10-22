import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { ProgramBuilder } from "@/components/train/program-builder";
import { CUSTOM_PROGRAM_TYPES, type CustomProgramType } from "@/lib/domain/custom-programs";
import type { Equipment, ExperienceLevel } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature } from "@/lib/domain/plans";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { loadExercises, toCatalog } from "@/server/services/catalog";
import { getActivePlanSummary } from "@/server/services/plan-summary";

export const metadata = { title: "Build my program" };

export default async function BuildProgramPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  if (!hasFeature(await getUserPlan(user.id), "custom_program_builder")) {
    return (
      <PlanLocked
        back={{ href: "/train", label: "Train" }}
        eyebrow="Build my program"
        title="Your custom program"
        plan="Plus"
        description="Build a periodized program around your goal, numbers, schedule and equipment — strength, bodybuilding, running and more. Your starter program and the free programs stay available on every plan."
      />
    );
  }
  const supabase = await getServerSupabase();
  const [{ data: answers }, { data: weight }, exercises, current] = await Promise.all([
    supabase.from("onboarding_answers").select("experience, days_per_week, session_minutes, equipment").eq("user_id", user.id).maybeSingle(),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
    loadExercises(supabase),
    getActivePlanSummary(supabase, user.id),
  ]);
  const initialType = CUSTOM_PROGRAM_TYPES.includes(type as CustomProgramType) ? (type as CustomProgramType) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/train">Train</BackLink>
      <PageHeader
        eyebrow="Build my program"
        title="Your custom program"
        description="Pick a style, tell us about you and your goal, and we'll build a periodized plan around your numbers, schedule and equipment."
      />
      <ProgramBuilder
        initialType={initialType}
        initial={{
          units: profile.unit_system,
          age: profile.birth_year ? new Date().getUTCFullYear() - profile.birth_year : undefined,
          heightCm: profile.height_cm ? Number(profile.height_cm) : undefined,
          weightKg: weight?.weight_kg ? Number(weight.weight_kg) : undefined,
          experience: (answers?.experience as ExperienceLevel | undefined) ?? undefined,
          daysPerWeek: (answers?.days_per_week as number | undefined) ?? undefined,
          sessionMinutes: (answers?.session_minutes as number | undefined) ?? undefined,
          equipment: (answers?.equipment as Equipment[] | undefined) ?? ["bodyweight", "mat"],
        }}
        catalog={toCatalog(exercises)}
        current={current}
      />
    </div>
  );
}
