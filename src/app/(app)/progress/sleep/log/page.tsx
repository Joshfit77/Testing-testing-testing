import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Notice } from "@/components/common/states";
import { BackLink } from "@/components/platform/back-link";
import { SleepSessionForm } from "@/components/sleep/session-form";
import { defaultManualNight } from "@/lib/domain/sleep";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getSleepSession } from "@/server/services/sleep";

export const metadata = { title: "Log sleep" };

export default async function SleepLogPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { id } = await searchParams;
  const tz = profile.timezone ?? "UTC";
  const supabase = await getServerSupabase();
  const session = id && /^[0-9a-f-]{36}$/i.test(id) ? await getSleepSession(supabase, user.id, id) : null;
  if (id && !session) notFound();

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title={session ? "Edit sleep" : "Enter sleep by hand"} description="When you got into bed and when you got up. The rest is optional." />
      {!profile.wellness_consent_at ? (
        <Notice tone="warning">Allow sleep logging on the Sleep & Recovery page first.</Notice>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5">
          <SleepSessionForm session={session ?? undefined} timezone={tz} defaults={defaultManualNight(new Date(), tz)} />
        </section>
      )}
    </div>
  );
}
