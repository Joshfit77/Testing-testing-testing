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
import { getActivity, getActivityGpsDetail } from "@/server/services/activities";
import { RouteMap } from "@/components/run/route-map";
import { Notice } from "@/components/common/states";

export const metadata = { title: "Activity" };

export default async function ActivityDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const a = await getActivity(supabase, user.id, id);
  if (!a) notFound();
  const gps = a.source === "gps" ? await getActivityGpsDetail(supabase, user.id, id) : null;
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

      {saved && (
        <Notice tone="success">
          {label} saved{gps?.workout_session_id ? " and marked done in your program" : ""}.
        </Notice>
      )}

      {gps?.route && (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Route</h2>
            <RouteMap coordinates={gps.route.coordinates} className="w-full" unit={unit} label={`Route of this ${label.toLowerCase()}`} />
            <p className="text-xs text-muted-foreground">
              Private to you. Drawn from your own GPS points{gps.route.coordinates.length > 1 ? "; breaks are pauses or stretches without a usable signal" : ""}.
            </p>
          </CardContent>
        </Card>
      )}

      {gps?.splits && gps.splits.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-gold">Splits</h2>
            <ol className="divide-y divide-border text-sm" data-testid="activity-splits">
              {gps.splits.map((sp, i) => {
                const prev = gps.splits![i - 1]?.moving_s ?? 0;
                return (
                  <li key={sp.index} className="flex justify-between py-1.5 tabular-nums">
                    <span>
                      {sp.index} {sp.unit}
                    </span>
                    <span>{formatDuration(sp.split_s ?? sp.moving_s - prev)}</span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {gps?.gps_quality && (gps.gps_quality.gaps > 0 || gps.gps_quality.rejected > 0) && (
        <p className="text-sm text-muted-foreground" data-testid="gps-quality">
          GPS:{" "}
          {gps.gps_quality.gaps > 0
            ? `the signal dropped ${gps.gps_quality.gaps} time${gps.gps_quality.gaps === 1 ? "" : "s"} (no distance added for those stretches${gps.gps_quality.uncountedGapM ? `: about ${formatDistance(gps.gps_quality.uncountedGapM, unit)} in a straight line` : ""})`
            : "no signal drops"}
          {gps.gps_quality.rejected > 0 ? `; ${gps.gps_quality.rejected} imprecise or impossible readings were ignored` : ""}.
        </p>
      )}

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
