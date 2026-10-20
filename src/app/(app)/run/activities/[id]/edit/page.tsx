import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActivityForm } from "@/components/run/activity-form";
import { Card, CardContent } from "@/components/ui/card";
import { distanceUnitFor, formatHms, fromMeters, utcToLocalParts } from "@/lib/domain/activities";
import { isoDateInTz } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getActivity } from "@/server/services/activities";

export const metadata = { title: "Edit activity" };

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const a = await getActivity(supabase, user.id, id);
  // GPS recordings aren't edited with the manual form (their source and route must stay intact).
  if (!a || a.source === "gps") notFound();
  const tz = profile.timezone || "UTC";
  const unit = distanceUnitFor(profile.unit_system);
  // The form works in the profile's time zone (the server converts with it on save).
  const local = utcToLocalParts(a.started_at, tz);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/run/activities/${a.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Activity
      </Link>
      <h1 className="font-display text-[1.625rem] font-bold leading-tight">Edit {a.kind}</h1>
      <Card>
        <CardContent className="pt-5">
          <ActivityForm
            mode="edit"
            today={isoDateInTz(new Date(), tz)}
            initial={{
              id: a.id,
              kind: a.kind,
              source: a.source as "manual" | "treadmill",
              date: local.date,
              time: local.time,
              distance: a.distance_m == null ? "" : String(Math.round(fromMeters(a.distance_m, unit) * 1000) / 1000),
              unit,
              duration: formatHms(a.elapsed_s),
              moving: a.moving_s === a.elapsed_s ? "" : formatHms(a.moving_s),
              effort: a.perceived_effort == null ? "" : String(a.perceived_effort),
              notes: a.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
