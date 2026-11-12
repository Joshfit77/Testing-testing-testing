import Link from "next/link";
import { ChevronRight, Footprints, PersonStanding } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_SOURCE_LABELS,
  formatDistance,
  formatMovingPace,
  type ActivityLike,
  type DistanceUnit,
  type KindTotals,
  type WeekTotals,
} from "@/lib/domain/activities";
import { formatDuration } from "@/lib/domain/units";

export function SourceBadge({ source }: { source: ActivityLike["source"] }) {
  return <Badge variant={source === "gps" ? "default" : "secondary"}>{ACTIVITY_SOURCE_LABELS[source]}</Badge>;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function kindLine(t: KindTotals, kind: "run" | "walk", unit: DistanceUnit) {
  if (t.count === 0) return `No ${kind}s`;
  return `${formatDistance(t.distanceM, unit)} · ${plural(t.count, kind)}`;
}

/** Run and walk totals for one week, kept separate. */
export function WeekTotalsLine({ totals, unit, testId }: { totals: WeekTotals; unit: DistanceUnit; testId?: string }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm" data-testid={testId}>
      <div className="rounded-xl bg-elevated px-3 py-2">
        <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Footprints className="size-3.5 text-gold" aria-hidden /> Running
        </dt>
        <dd className="mt-0.5 font-semibold" data-testid={testId ? `${testId}-run` : undefined}>
          {kindLine(totals.run, "run", unit)}
        </dd>
      </div>
      <div className="rounded-xl bg-elevated px-3 py-2">
        <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <PersonStanding className="size-3.5 text-gold" aria-hidden /> Walking
        </dt>
        <dd className="mt-0.5 font-semibold" data-testid={testId ? `${testId}-walk` : undefined}>
          {kindLine(totals.walk, "walk", unit)}
        </dd>
      </div>
    </dl>
  );
}

export function ActivityListItem({ a, unit, timeZone }: { a: ActivityLike; unit: DistanceUnit; timeZone: string }) {
  const when = new Date(a.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
  const pace = a.distance_m ? ` · ${formatMovingPace(a, unit)}` : "";
  return (
    <Link
      href={`/run/activities/${a.id}`}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted"
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {ACTIVITY_KIND_LABELS[a.kind]} · {a.distance_m == null ? formatDuration(a.moving_s) : formatDistance(a.distance_m, unit)}
          <SourceBadge source={a.source} />
        </p>
        <p className="text-xs text-muted-foreground">
          {when} · {formatDuration(a.elapsed_s)}
          {pace}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
    </Link>
  );
}
