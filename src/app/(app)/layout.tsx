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
import { JourneyCheckinSync } from "@/components/faith/journey-checkin-sync";
import { NotificationSync } from "@/components/notifications/notification-sync";
import { getNotificationSyncAction, importDeviceWorkoutReminderAction } from "@/server/actions/notifications";
import { DemoBar } from "@/components/demo/demo-bar";
import { demoAccount, demoAiSimulated, isDemoMode, isDemoUser } from "@/server/demo";
import { isoDateInTz } from "@/lib/domain/dates";

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
      redLetters={profile.bible_red_letters ?? true}
      biblePageTheme={profile.bible_page_theme ?? "dark"}
      isAdmin={profile.role === "admin"}
      plan={getPlans()[plan].name}
      signOutAction={signOutAction}
      today={isoDateInTz(new Date(), profile.timezone)}
    >
      {/* Stage 1C: scroll + section memory, keyboard avoidance and per-user form drafts. */}
      <Suspense fallback={null}>
        <ScrollMemory />
      </Suspense>
      <KeyboardAvoidance />
      {/* In the iPhone/Android app: keep this phone's reminders (Faith, workouts, food, recovery) in line with the account. */}
      <NotificationSync load={getNotificationSyncAction} importWorkout={importDeviceWorkoutReminderAction} />
      {/* Journey check-ins tapped offline are sent from any screen once the connection is back. */}
      <JourneyCheckinSync userId={user.id} />
      {isDemoMode() && <DemoBar plan={plan} canSwitch={isDemoUser(user)} canReset={isDemoUser(user) && user.email === demoAccount()?.email} aiSimulated={demoAiSimulated()} />}
      <DraftUserProvider userId={user.id}>{children}</DraftUserProvider>
    </AppShell>
  );
}
