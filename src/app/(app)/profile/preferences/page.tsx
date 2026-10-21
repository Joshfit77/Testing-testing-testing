import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import type { DietaryPreference, Equipment, ExperienceLevel, PrimaryGoal, ProgramType, SecondaryGoal } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDietType } from "@/lib/domain/diets";
import type { Sex } from "@/lib/domain/nutrition";
import { requireOnboardedUser } from "@/server/auth";
import { SchedulePreview } from "@/components/train/schedule-preview";
import { loadExercises, toCatalog } from "@/server/services/catalog";
import { getActivePlanSummary } from "@/server/services/plan-summary";

export const metadata = { title: "Training preferences" };

export default async function PreferencesPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [{ data: a }, { data: w }, exercises, current] = await Promise.all([
    supabase.from("onboarding_answers").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
    loadExercises(supabase),
    getActivePlanSummary(supabase, user.id),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Profile
      </Link>
      <PageHeader title="Training preferences" description="Update any onboarding answer. Optionally rebuild your starter program from the new answers." />
      {a?.primary_goal && profile.birth_year && profile.height_cm && w?.weight_kg && (
        <SchedulePreview
          answers={{
            goal: a.primary_goal as PrimaryGoal,
            experience: a.experience as ExperienceLevel,
            daysPerWeek: a.days_per_week as number,
            sessionMinutes: a.session_minutes as number,
            age: new Date().getUTCFullYear() - profile.birth_year,
            heightCm: Number(profile.height_cm),
            bodyweightKg: Number(w.weight_kg),
            equipment: (a.equipment as Equipment[] | undefined) ?? [],
            units: profile.unit_system,
            secondaryGoal: (a.secondary_goal as string | null | undefined) ?? null,
          }}
          catalog={toCatalog(exercises)}
          current={current}
        />
      )}
      <OnboardingWizard
        mode="edit"
        initial={{
          displayName: profile.display_name ?? "",
          age: profile.birth_year ? new Date().getUTCFullYear() - profile.birth_year : undefined,
          unitSystem: profile.unit_system,
          heightCm: profile.height_cm ? Number(profile.height_cm) : undefined,
          weightKg: w?.weight_kg ? Number(w.weight_kg) : undefined,
          primaryGoal: a?.primary_goal as PrimaryGoal | undefined,
          secondaryGoal: (a?.secondary_goal as SecondaryGoal | null | undefined) ?? null,
          textSize: profile.text_size ?? "default",
          reduceMotion: profile.reduce_motion ?? false,
          experience: a?.experience as ExperienceLevel | undefined,
          daysPerWeek: a?.days_per_week as number | undefined,
          sessionMinutes: a?.session_minutes as number | undefined,
          equipment: (a?.equipment as Equipment[] | undefined) ?? [],
          preferredTypes: (a?.preferred_types as ProgramType[] | undefined) ?? [],
          dietaryPreferences: (a?.dietary_preferences as DietaryPreference[] | undefined) ?? ["no_preference"],
          limitations: (a?.limitations as string | null) ?? "",
          wellnessConsent: Boolean(profile.wellness_consent_at),
          faithEnabled: profile.faith_enabled,
          sex: (profile.sex as Sex | null) ?? undefined,
          dietType: isDietType(a?.diet_type) ? a.diet_type : "balanced",
        }}
      />
    </div>
  );
}
