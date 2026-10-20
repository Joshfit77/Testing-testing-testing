import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { getActiveProgram } from "@/server/services/training";

export const metadata = { title: "Training calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthStart(month: string) {
  return `${month}-01`;
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const first = monthStart(month);
  const count = daysInMonth(month);
  const last = addDays(first, count - 1);

  const [sessionsRes, active] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, name, started_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("started_at", `${addDays(first, -1)}T00:00:00Z`)
      .lt("started_at", `${addDays(last, 2)}T00:00:00Z`)
      .order("started_at"),
    getActiveProgram(supabase, user.id),
  ]);
  const sessions = (sessionsRes.data ?? [])
    .map((s) => ({ id: s.id as string, name: s.name as string, date: isoDateInTz(new Date(s.started_at as string), profile.timezone) }))
    .filter((s) => s.date >= first && s.date <= last);
  const byDate = new Map<string, typeof sessions>();
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  // Upcoming program sessions in order. Programs aren't pinned to dates yet, so these are listed, not placed on days.
  let upcoming: { id: string; label: string; name: string; minutes: number | null }[] = [];
  if (active) {
    const { data: weeks } = await supabase
      .from("program_weeks")
      .select("week_number, program_days(id, day_number, name, estimated_minutes)")
      .eq("program_id", active.programId)
      .gte("week_number", active.currentWeek)
      .order("week_number")
      .limit(2);
    upcoming = ((weeks ?? []) as unknown as { week_number: number; program_days: { id: string; day_number: number; name: string; estimated_minutes: number | null }[] }[])
      .flatMap((w) =>
        [...w.program_days]
          .sort((a, b) => a.day_number - b.day_number)
          .filter((d) => w.week_number > active.currentWeek || d.day_number >= active.currentDay)
          .map((d) => ({ id: d.id, label: `Week ${w.week_number} · Day ${d.day_number}`, name: d.name, minutes: d.estimated_minutes })),
      )
      .slice(0, 6);
  }

  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday-first offset
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const monthLabel = new Date(`${first}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <MainHeader title="Training calendar" subtitle="Completed sessions by day and what's next in your program." />

      <section className="rounded-2xl border border-border bg-card p-3" aria-labelledby="month-title">
        <div className="mb-2 flex items-center justify-between">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="flex size-11 items-center justify-center rounded-lg hover:bg-elevated">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h2 id="month-title" className="text-base font-semibold">
            {monthLabel}
          </h2>
          <Link href={`/calendar?month=${shiftMonth(month, 1)}`} aria-label="Next month" className="flex size-11 items-center justify-center rounded-lg hover:bg-elevated">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center" role="presentation">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-1 text-xs font-medium text-muted-foreground" aria-hidden>
              {d.charAt(0)}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} aria-hidden />;
            const done = byDate.get(d)?.length ?? 0;
            const label = new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
            return (
              <span
                key={d}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-sm tabular-nums",
                  d === today && "ring-1 ring-gold",
                  done ? "bg-gold/15 font-semibold text-gold-highlight" : "text-foreground/80",
                )}
              >
                <span className="sr-only">
                  {label}: {done ? `${done} completed session${done > 1 ? "s" : ""}` : "no sessions"}
                </span>
                <span aria-hidden>{Number(d.slice(8))}</span>
                {done > 0 && <span aria-hidden className="mt-0.5 size-1.5 rounded-full bg-gold" />}
              </span>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-gold" aria-hidden /> Completed workout. Runs and walks appear here once the Run tab records them.
        </p>
      </section>

      <section aria-labelledby="done-title">
        <h2 id="done-title" className="mb-2 text-lg font-semibold">
          Completed in {monthLabel.split(" ")[0]}
        </h2>
        {sessions.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {[...sessions].reverse().map((s) => (
              <li key={s.id}>
                <Link href={`/train/history/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-elevated/50">
                  <Dumbbell className="size-4 shrink-0 text-gold" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {new Date(`${s.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-gold" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No completed sessions this month.</p>
        )}
      </section>

      <section aria-labelledby="next-title">
        <h2 id="next-title" className="mb-2 text-lg font-semibold">
          Up next
        </h2>
        {active && upcoming.length ? (
          <>
            <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
              {upcoming.map((u) => (
                <li key={u.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {u.label}
                      {u.minutes ? ` · ${u.minutes} min` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm text-muted-foreground">
              Sessions from {active.programName}, in order. Assigning dates and rescheduling aren&apos;t available yet.
            </p>
          </>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No active program. <Link href="/train" className="font-semibold text-gold-highlight underline">Choose one in Train</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
