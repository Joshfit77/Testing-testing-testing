import { BackLink } from "@/components/platform/back-link";
import { notFound } from "next/navigation";
import { ActivityForm } from "@/components/run/activity-form";
import { GpsNotesForm } from "@/components/run/gps-notes-form";
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
  if (!a) notFound();
  // A GPS recording keeps what was measured (distance, times, route): only its notes and effort can be changed.
  if (a.source === "gps") {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <BackLink href={`/run/activities/${a.id}`}>Activity</BackLink>
        <h1 className="font-display text-[1.625rem] font-bold leading-tight">Edit {a.kind}</h1>
        <Card>
          <CardContent className="pt-5">
            <GpsNotesForm id={a.id} effort={a.perceived_effort == null ? "" : String(a.perceived_effort)} notes={a.notes ?? ""} />
          </CardContent>
        </Card>
      </div>
    );
  }
  const tz = profile.timezone || "UTC";
  const unit = distanceUnitFor(profile.unit_system);
  // The form works in the profile's time zone (the server converts with it on save).
  const local = utcToLocalParts(a.started_at, tz);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href={`/run/activities/${a.id}`}>Activity</BackLink>
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
