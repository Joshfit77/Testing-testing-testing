import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPinOff, Pencil } from "lucide-react";
import { DeleteActivityButton } from "@/components/run/delete-activity-button";
import { SourceBadge } from "@/components/run/activity-summary-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACTIVITY_KIND_LABELS, distanceUnitFor, formatDistance, formatMovingPace } from "@/lib/domain/activities";
import { formatDuration } from "@/lib/domain/units";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getActivity } from "@/server/services/activities";

export const metadata = { title: "Activity" };

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const a = await getActivity(supabase, user.id, id);
  if (!a) notFound();
  const unit = distanceUnitFor(profile.unit_system);
  // Shown in the time zone where it was logged.
  const when = new Date(a.started_at).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: a.timezone,
  });
  const label = ACTIVITY_KIND_LABELS[a.kind];
  const paused = a.elapsed_s - a.moving_s;
  const stats: { label: string; value: string; testId: string }[] = [
    { label: "Distance", value: a.distance_m == null ? "Not recorded" : formatDistance(a.distance_m, unit), testId: "activity-distance" },
    { label: "Avg moving pace", value: formatMovingPace(a, unit), testId: "activity-pace" },
    { label: "Duration", value: formatDuration(a.elapsed_s), testId: "activity-duration" },
    { label: "Moving time", value: formatDuration(a.moving_s), testId: "activity-moving" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/run?tab=history" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Run history
      </Link>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[1.625rem] font-bold leading-tight">{label}</h1>
          <SourceBadge source={a.source} />
        </div>
        <p className="text-sm text-muted-foreground">{when}</p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <dl className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-elevated px-3 py-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                <dd className="font-display text-xl font-bold" data-testid={s.testId}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            {paused > 0 && <p>Stopped for {formatDuration(paused)}; pace uses moving time only.</p>}
            {a.perceived_effort != null && <p>Perceived effort: {a.perceived_effort}/10</p>}
            {a.source !== "gps" && <p>Self-reported: distance and time were entered by you, not measured by the app.</p>}
          </div>
        </CardContent>
      </Card>

      {a.notes && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-gold">Notes</h2>
            <p className="whitespace-pre-wrap text-sm" data-testid="activity-notes">
              {a.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {a.source !== "gps" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPinOff className="size-4 shrink-0" aria-hidden /> No route: {a.source === "treadmill" ? "treadmill" : "manual"} entries don&apos;t have GPS data.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {a.source !== "gps" && (
          <Button asChild variant="secondary" className="w-full sm:flex-1">
            <Link href={`/run/activities/${a.id}/edit`}>
              <Pencil aria-hidden /> Edit
            </Link>
          </Button>
        )}
        <DeleteActivityButton id={a.id} label={label.toLowerCase()} />
      </div>
    </div>
  );
}
