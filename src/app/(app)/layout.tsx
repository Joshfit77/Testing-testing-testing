import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ScrollMemory } from "@/components/shell/scroll-memory";
import { KeyboardAvoidance } from "@/components/platform/keyboard-avoidance";
import { DraftUserProvider } from "@/lib/use-draft";
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
      textSize={profile.text_size ?? "default"}
      reduceMotion={profile.reduce_motion ?? false}
      isAdmin={profile.role === "admin"}
      plan={getPlans()[plan].name}
      signOutAction={signOutAction}
    >
      {/* Stage 1C: scroll + section memory, keyboard avoidance and per-user form drafts. */}
      <Suspense fallback={null}>
        <ScrollMemory />
      </Suspense>
      <KeyboardAvoidance />
      <DraftUserProvider userId={user.id}>{children}</DraftUserProvider>
    </AppShell>
  );
}
