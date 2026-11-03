import Link from "next/link";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { FaithRemindersSettings } from "@/components/faith/faith-reminders-settings";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { loadFaithReminders } from "@/server/services/faith";

export const metadata = { title: "Faith reminders" };

export default async function FaithRemindersPage() {
  const { user } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const [reminders, prefs] = await Promise.all([loadFaithReminders(supabase, user.id), supabase.from("faith_reminder_prefs").select("quiet_start, quiet_end").eq("user_id", user.id).maybeSingle()]);
  const q = prefs.data;
  const quiet = q?.quiet_start && q?.quiet_end ? { start: String(q.quiet_start).slice(0, 5), end: String(q.quiet_end).slice(0, 5) } : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Faith reminders" description="Choose if, when and on which days you'd like a nudge." className="mb-2" />
      <FaithRemindersSettings initial={reminders} initialQuiet={quiet} />
      <p className="text-sm text-muted-foreground">
        Workout reminders are separate, in{" "}
        <Link href="/profile#reminders" className="font-semibold text-gold-highlight underline">
          Profile &amp; Settings
        </Link>
        .
      </p>
    </div>
  );
}
