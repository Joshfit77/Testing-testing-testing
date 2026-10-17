import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { WorkoutReminders } from "@/components/profile/workout-reminders";
import type { DietaryPreference, Equipment, ExperienceLevel, PrimaryGoal, ProgramType } from "@/lib/domain/types";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDietType } from "@/lib/domain/diets";
import type { Sex } from "@/lib/domain/nutrition";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Training preferences" };

export default async function PreferencesPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [{ data: a }, { data: w }] = await Promise.all([
    supabase.from("onboarding_answers").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", user.id).order("recorded_on", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Profile
      </Link>
      <PageHeader title="Training preferences" description="Update any onboarding answer. Optionally rebuild your starter program from the new answers." />
      <OnboardingWizard
        mode="edit"
        initial={{
          displayName: profile.display_name ?? "",
          age: profile.birth_year ? new Date().getUTCFullYear() - profile.birth_year : undefined,
          unitSystem: profile.unit_system,
          heightCm: profile.height_cm ? Number(profile.height_cm) : undefined,
          weightKg: w?.weight_kg ? Number(w.weight_kg) : undefined,
          primaryGoal: a?.primary_goal as PrimaryGoal | undefined,
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
      <WorkoutReminders faithEnabled={profile.faith_enabled} />
    </div>
  );
}
