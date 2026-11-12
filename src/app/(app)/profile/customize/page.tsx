import { PageHeader } from "@/components/common/page-header";
import { CustomizeLayout } from "@/components/profile/customize-layout";
import type { ExperienceLevel, PrimaryGoal } from "@/lib/domain/types";
import { defaultHomeOrder, parseLayoutPrefs } from "@/lib/layout-prefs";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";

export const metadata = { title: "Customize Home" };

/** You → Customize Home: the order and visibility of the Home modules and the Faith sections, saved on the profile. */
export default async function CustomizeHomePage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const { data: answers } = await supabase.from("onboarding_answers").select("primary_goal, experience, days_per_week, session_minutes").eq("user_id", user.id).maybeSingle();
  const defaultOrder = defaultHomeOrder({
    goal: (answers?.primary_goal as PrimaryGoal | undefined) ?? null,
    experience: (answers?.experience as ExperienceLevel | undefined) ?? null,
    daysPerWeek: (answers?.days_per_week as number | undefined) ?? null,
    sessionMinutes: (answers?.session_minutes as number | undefined) ?? null,
    faithEnabled: profile.faith_enabled ?? true,
    homeScripture: profile.home_scripture ?? true,
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Customize Home" description="Choose and order what Home and the Faith tab show first. The default follows your goal and schedule." back={{ href: "/profile", label: "You" }} />
      <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-label="Home and Faith layout">
        <CustomizeLayout defaultOrder={defaultOrder} prefs={parseLayoutPrefs(profile.layout_prefs)} />
      </section>
    </div>
  );
}
