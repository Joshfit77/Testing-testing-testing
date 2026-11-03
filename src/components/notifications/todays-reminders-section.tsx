import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NotificationTodaySync } from "@/components/notifications/notification-sync";
import { TodaysReminders } from "@/components/notifications/todays-reminders";
import { todaysReminders } from "@/lib/notifications/planner";
import { logError } from "@/server/log";
import { loadNotificationSettings, loadPlannerContext } from "@/server/services/notifications";

/**
 * Home: cancels today's reminders on this phone for what's already done, and (where this device can't show
 * notifications) lists today's reminders instead. Renders nothing until the member has turned a reminder on.
 */
export async function TodaysRemindersSection({ supabase, userId, profile }: { supabase: SupabaseClient; userId: string; profile: { timezone?: string | null; faith_enabled?: boolean | null } }) {
  try {
    // Settings first (three small reads): most members have no reminder on, and then nothing else is loaded.
    const settings = await loadNotificationSettings(supabase, userId);
    const anyOn = settings.faith.some((r) => r.enabled) || settings.app.some((r) => r.enabled);
    if (!anyOn) return null;
    const context = await loadPlannerContext(supabase, userId, profile);
    const items = settings.prefs.paused ? [] : todaysReminders({ ...settings, ctx: { ...context, now: new Date() } });
    return (
      <>
        <NotificationTodaySync today={context.today} done={context.done} />
        <TodaysReminders items={items} />
      </>
    );
  } catch (err) {
    logError("home.reminders", err);
    return null;
  }
}
