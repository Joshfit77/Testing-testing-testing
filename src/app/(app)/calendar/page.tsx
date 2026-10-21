import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell, Footprints, Moon, PersonStanding, Undo2, CalendarClock } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { MoveSession } from "@/components/calendar/move-session";
import { MainHeader } from "@/components/shell/main-header";
import { buildCalendar, isIsoDate, isMonth, monthGrid, shiftMonth, type CalendarDay, type CalendarEntry, type CompletedItem } from "@/lib/domain/calendar";
import { activeMinutes } from "@/lib/domain/activity-week";
import { addDays, isoDateInTz, startOfWeek } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { resetPlannedSessionAction } from "@/server/actions/calendar";
import { loadProgramSchedule } from "@/server/services/schedule";

export const metadata = { title: "Training calendar" };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

const KIND_META: Record<CalendarEntry["kind"], { label: string; dot: string; icon: typeof Dumbbell }> = {
  workout: { label: "Workout", dot: "bg-gold", icon: Dumbbell },
  run: { label: "Run", dot: "bg-[#7fb3d5]", icon: Footprints },
  walk: { label: "Walk", dot: "bg-[#5fc49a]", icon: PersonStanding },
  planned: { label: "Planned session", dot: "border border-gold bg-transparent", icon: CalendarClock },
  rest: { label: "Rest day", dot: "bg-muted-foreground/40", icon: Moon },
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; week?: string; day?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const tz = profile.timezone;
  const today = isoDateInTz(new Date(), tz);
  const view = sp.view === "week" ? "week" : "month";

  const month = isMonth(sp.month) ? sp.month : (isIsoDate(sp.day) ? sp.day : today).slice(0, 7);
  const weekStart = startOfWeek(isIsoDate(sp.week) ? sp.week : isIsoDate(sp.day) ? sp.day : today);
  const grid = monthGrid(month);
  const range = view === "week" ? { from: weekStart, to: addDays(weekStart, 6) } : { from: grid.from, to: grid.to };
  // A day either side so time-zone offsets can't drop a session at the edges.
  const fromTs = `${addDays(range.from, -1)}T00:00:00Z`;
  const toTs = `${addDays(range.to, 2)}T00:00:00Z`;

  const [sessionsRes, actsRes, schedule] = await Promise.all([
    supabase.from("workout_sessions").select("id, name, started_at, ended_at, paused_seconds").eq("user_id", user.id).eq("status", "completed").gte("started_at", fromTs).lt("started_at", toTs).order("started_at"),
    supabase.from("activities").select("id, kind, source, started_at, distance_m, moving_s").eq("user_id", user.id).is("deleted_at", null).gte("started_at", fromTs).lt("started_at", toTs).order("started_at"),
    loadProgramSchedule(supabase, user.id, tz),
  ]);
  const workouts: CompletedItem[] = (sessionsRes.data ?? []).map((w) => ({
    id: w.id as string,
    date: isoDateInTz(new Date(w.started_at as string), tz),
    name: w.name as string,
    minutes: activeMinutes(w.started_at as string, (w.ended_at as string | null) ?? null, Number(w.paused_seconds ?? 0)),
  }));
  const acts = (actsRes.data ?? []).map((a) => ({
    kind: a.kind as "run" | "walk",
    item: {
      id: a.id as string,
      date: isoDateInTz(new Date(a.started_at as string), tz),
      name: `${a.kind === "run" ? "Run" : "Walk"}${a.source === "treadmill" ? " (treadmill)" : ""}`,
      minutes: Math.round(Number(a.moving_s) / 60),
      distanceM: a.distance_m == null ? null : Number(a.distance_m),
    },
  }));
  const planned = schedule?.planned ?? [];
  const days = buildCalendar(
    { workouts, runs: acts.filter((a) => a.kind === "run").map((a) => a.item), walks: acts.filter((a) => a.kind === "walk").map((a) => a.item), planned, hasProgram: Boolean(schedule) },
    range,
    today,
    profile.unit_system,
  );
  const minDateFor = (index: number) => {
    const prev = index > 0 ? planned[index - 1]?.date : undefined;
    return prev && prev > today ? prev : today;
  };

  const selectedDay = isIsoDate(sp.day) ? sp.day : today;
  const selected = days.find((d) => d.date === selectedDay) ?? null;
  const monthLabel = fmt(grid.first, { month: "long", year: "numeric" });
  const weekLabel = `${fmt(range.from, { month: "short", day: "numeric" })} – ${fmt(range.to, { month: "short", day: "numeric", year: "numeric" })}`;
  const prevHref = view === "week" ? `/calendar?view=week&week=${addDays(weekStart, -7)}` : `/calendar?month=${shiftMonth(month, -1)}`;
  const nextHref = view === "week" ? `/calendar?view=week&week=${addDays(weekStart, 7)}` : `/calendar?month=${shiftMonth(month, 1)}`;
  const upcoming = planned.slice(0, 5);

  const entryList = (d: CalendarDay) =>
    d.entries.length ? (
      <ul className="space-y-2">
        {d.entries.map((e) => (
          <EntryRow key={e.id} entry={e} minDate={e.planned ? minDateFor(e.planned.index) : today} />
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">{d.isPast ? "Nothing logged." : "Nothing planned."}</p>
    );

  return (
    <div className="space-y-4">
      <MainHeader title="Training calendar" subtitle="Workouts, runs, walks, planned sessions and rest days." />

      <div className="flex items-center justify-between gap-2">
        <nav aria-label="Calendar view" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
          {(["month", "week"] as const).map((v) => (
            <Link
              key={v}
              href={v === "week" ? `/calendar?view=week&week=${startOfWeek(selectedDay)}` : `/calendar?month=${selectedDay.slice(0, 7)}&day=${selectedDay}`}
              aria-current={view === v ? "page" : undefined}
              className={cn("flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold", view === v ? "bg-gold/15 text-gold-highlight" : "text-muted-foreground")}
            >
              {v === "month" ? "Month" : "Week"}
            </Link>
          ))}
        </nav>
        <Link href={view === "week" ? "/calendar?view=week" : "/calendar"} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-gold-highlight hover:underline">
          Today
        </Link>
      </div>

      <section className="rounded-2xl border border-border bg-card p-3" aria-labelledby="cal-title">
        <div className="mb-2 flex items-center justify-between">
          <Link href={prevHref} aria-label={view === "week" ? "Previous week" : "Previous month"} className="flex size-11 items-center justify-center rounded-lg hover:bg-elevated">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h2 id="cal-title" className="text-base font-semibold">
            {view === "week" ? weekLabel : monthLabel}
          </h2>
          <Link href={nextHref} aria-label={view === "week" ? "Next week" : "Next month"} className="flex size-11 items-center justify-center rounded-lg hover:bg-elevated">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>

        {view === "month" ? (
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="pb-1 text-xs font-medium text-muted-foreground" aria-hidden>
                {d}
              </span>
            ))}
            {days.map((d) => {
              const inMonth = d.date >= grid.first && d.date <= grid.last;
              if (!inMonth) return <span key={d.date} aria-hidden />;
              const kinds = [...new Set(d.entries.map((e) => e.kind))];
              const summary = d.entries.length ? d.entries.map((e) => `${KIND_META[e.kind].label}: ${e.title}`).join("; ") : "nothing";
              return (
                <Link
                  key={d.date}
                  href={`/calendar?month=${month}&day=${d.date}`}
                  scroll={false}
                  aria-label={`${fmt(d.date, { weekday: "long", month: "long", day: "numeric" })}: ${summary}`}
                  aria-current={d.date === selectedDay ? "date" : undefined}
                  className={cn(
                    "flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg text-sm tabular-nums",
                    d.isToday && "ring-1 ring-gold",
                    d.date === selectedDay && "bg-elevated",
                    d.entries.some((e) => e.kind !== "rest" && e.kind !== "planned") ? "font-semibold text-gold-highlight" : d.isPast ? "text-foreground/60" : "text-foreground/85",
                  )}
                >
                  <span aria-hidden>{Number(d.date.slice(8))}</span>
                  <span aria-hidden className="mt-0.5 flex h-1.5 gap-0.5">
                    {kinds.map((k) => (
                      <span key={k} className={cn("size-1.5 rounded-full", KIND_META[k].dot)} />
                    ))}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <ol className="divide-y divide-border" aria-label="Days this week">
            {days.map((d) => (
              <li key={d.date} className={cn("py-3", d.isToday && "rounded-lg bg-gold/5 px-2")}>
                <h3 className="mb-2 text-sm font-semibold">
                  {fmt(d.date, { weekday: "long", month: "short", day: "numeric" })}
                  {d.isToday && <span className="ml-2 text-xs font-semibold text-gold">Today</span>}
                </h3>
                {entryList(d)}
              </li>
            ))}
          </ol>
        )}

        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground" aria-label="Legend">
          {(Object.keys(KIND_META) as CalendarEntry["kind"][]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", KIND_META[k].dot)} aria-hidden /> {KIND_META[k].label}
            </li>
          ))}
        </ul>
      </section>

      {view === "month" && selected && (
        <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="day-title">
          <h2 id="day-title" className="mb-3 text-base font-semibold">
            {fmt(selected.date, { weekday: "long", month: "long", day: "numeric" })}
            {selected.isToday && <span className="ml-2 text-xs font-semibold text-gold">Today</span>}
          </h2>
          {entryList(selected)}
        </section>
      )}

      <section aria-labelledby="next-title">
        <h2 id="next-title" className="mb-2 text-lg font-semibold">
          Up next
        </h2>
        {schedule && upcoming.length ? (
          <>
            <ul className="space-y-2">
              {upcoming.map((p) => (
                <EntryRow
                  key={p.dayId}
                  entry={{
                    kind: "planned",
                    id: p.dayId,
                    date: p.date,
                    title: p.name,
                    detail: `${fmt(p.date, { weekday: "short", month: "short", day: "numeric" })} · Week ${p.week} · Day ${p.day}${p.minutes ? ` · ${p.minutes} min` : ""}`,
                    href: null,
                    planned: { dayId: p.dayId, moved: p.moved, defaultDate: p.defaultDate, index: p.index, week: p.week, day: p.day },
                  }}
                  minDate={minDateFor(p.index)}
                />
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              {schedule.programName}, in order. Sessions you haven&apos;t done roll forward to today; the rest fall on your usual training days. Moving a session never changes
              workouts you&apos;ve already done.
            </p>
          </>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No active program.{" "}
            <Link href="/train" className="font-semibold text-gold-highlight underline">
              Choose one in Train
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function EntryRow({ entry: e, minDate }: { entry: CalendarEntry; minDate: string }) {
  const meta = KIND_META[e.kind];
  const Icon = meta.icon;
  const body = (
    <>
      <Icon className={cn("size-5 shrink-0", e.kind === "rest" ? "text-muted-foreground" : "text-gold")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{e.title}</span>
        <span className="block text-sm text-muted-foreground">
          {e.kind === "rest" ? "Recovery is part of training." : [meta.label, e.detail].filter(Boolean).join(" · ")}
          {e.planned?.moved && <span className="ml-1 font-semibold text-gold-highlight">· Moved</span>}
        </span>
      </span>
    </>
  );
  if (e.href) {
    return (
      <li>
        <Link href={e.href} className="flex min-h-14 items-center gap-3 rounded-xl bg-elevated/50 px-3 py-2 hover:bg-elevated">
          {body}
          <ChevronRight className="size-4 shrink-0 text-gold" aria-hidden />
        </Link>
      </li>
    );
  }
  return (
    <li className="rounded-xl bg-elevated/50 px-3 py-2" data-testid={e.planned ? "planned-session" : undefined}>
      <div className="flex min-h-10 items-center gap-3">{body}</div>
      {e.planned && (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <MoveSession dayId={e.planned.dayId} name={e.title} date={e.date} minDate={minDate} />
          {e.planned.moved && (
            <ActionButton action={resetPlannedSessionAction} fields={{ dayId: e.planned.dayId }} variant="ghost" size="sm">
              <Undo2 aria-hidden /> Back to {fmt(e.planned.defaultDate, { weekday: "short", month: "short", day: "numeric" })}
            </ActionButton>
          )}
        </div>
      )}
    </li>
  );
}
