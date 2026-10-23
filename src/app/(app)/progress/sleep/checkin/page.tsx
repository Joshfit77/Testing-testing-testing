import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { SleepCheckinForm } from "@/components/sleep/checkin-form";
import { formatNightDate } from "@/components/sleep/session-list";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { deleteSleepCheckinAction } from "@/server/actions/sleep-checkins";
import { getSleepCheckin } from "@/server/services/sleep";

export const metadata = { title: "Sleep check-in" };

export default async function SleepCheckinPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { day: raw } = await searchParams;
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const day = raw ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > addDays(today, 1) || day < addDays(today, -60)) notFound();
  const supabase = await getServerSupabase();
  const checkin = await getSleepCheckin(supabase, user.id, day);

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader
        eyebrow="Sleep & Recovery"
        title={day === today ? "Today's check-in" : `Check-in for ${formatNightDate(day)}`}
        description="Twenty seconds, all optional. Over time these show which habits go with your better and worse nights."
        actions={
          checkin ? (
            <ActionButton action={deleteSleepCheckinAction} fields={{ day }} variant="secondary" navigateTo="/progress/sleep" confirmMessage="Clear this day's check-in?" confirmLabel="Clear">
              <Trash2 className="size-4" aria-hidden /> Clear
            </ActionButton>
          ) : undefined
        }
      />
      {!profile.wellness_consent_at ? <Notice tone="warning">Allow sleep logging on the Sleep & Recovery page first.</Notice> : <SleepCheckinForm day={day} checkin={checkin} />}
    </div>
  );
}
