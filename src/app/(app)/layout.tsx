import { AppShell } from "@/components/shell/app-shell";
import { SetupRequired } from "@/components/common/setup-required";
import { isSupabaseConfigured } from "@/lib/env";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { signOutAction } from "@/server/actions/auth";
import { getPlans } from "@/lib/domain/plans";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  return (
    <AppShell
      userId={user.id}
      displayName={profile.display_name ?? "Athlete"}
      faithEnabled={profile.faith_enabled}
      isAdmin={profile.role === "admin"}
      plan={getPlans()[plan].name}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
