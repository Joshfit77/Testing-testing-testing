import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { NotificationSettingsForm } from "@/components/notifications/notification-settings";
import { requireOnboardedUser } from "@/server/auth";
import { getNotificationSyncAction } from "@/server/actions/notifications";

export const metadata = { title: "Notifications" };

/** "HH:MM" thirty minutes before the bedtime the sleep goal implies (wake time minus sleep goal), or null. */
function windDownFrom(wake: string | null | undefined, goalMinutes: number | null | undefined): string | null {
  const m = /^(\d{2}):(\d{2})/.exec(wake ?? "");
  if (!m || !goalMinutes) return null;
  const t = (((Number(m[1]) * 60 + Number(m[2]) - goalMinutes - 30) % 1440) + 1440) % 1440;
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
