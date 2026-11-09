import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { NotificationSettingsForm } from "@/components/notifications/notification-settings";
import { requireOnboardedUser } from "@/server/auth";
import { getNotificationSyncAction } from "@/server/actions/notifications";
import { sleepWindows, windDownStart } from "@/lib/domain/sleep-schedule";
import { clockToMinutes } from "@/lib/domain/sleep-checkins";

export const metadata = { title: "Notifications" };

/**
 * "HH:MM" wind-down suggestion from the member's target wake time and sleep goal: the same time the sleep screens show
 * (half an hour before the bedtime window opens, from `sleepWindows`), or null without a wake time and goal.
 */
function windDownFrom(wake: string | null | undefined, goalMinutes: number | null | undefined): string | null {
  const wakeMinutes = clockToMinutes(wake ?? null);
  if (wakeMinutes === null || !goalMinutes) return null;
  const bedWindow = sleepWindows([], goalMinutes, wakeMinutes).bedWindow;
  if (!bedWindow) return null;
  const t = windDownStart(bedWindow);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export default async function NotificationsPage() {
  const { profile } = await requireOnboardedUser();
  const sync = await getNotificationSyncAction(null);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/profile">Profile</BackLink>
      <PageHeader
        title="Notifications"
        description="Optional reminders for Faith, workouts, food and recovery. Each one is off until you turn it on."
        className="mb-2"
      />
      <NotificationSettingsForm
        initial={{ faith: sync.faith, app: sync.app, prefs: sync.prefs }}
        context={sync.context}
        timezone={sync.context.timezone}
        devices={sync.devices}
        windDownSuggestion={windDownFrom(profile.sleep_target_wake, profile.sleep_goal_minutes)}
      />
    </div>
  );
}
