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
  const reminders = await loadFaithReminders(supabase, user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Faith reminders" description="Choose if, when and on which days you'd like a nudge." className="mb-2" />
      <FaithRemindersSettings initial={reminders} />
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
