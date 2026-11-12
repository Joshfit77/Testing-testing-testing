import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BackLink } from "@/components/platform/back-link";
import { PageHeader } from "@/components/common/page-header";
import { isMonth, monthGrid, shiftMonth } from "@/lib/domain/calendar";
import { eachDay, isoDateInTz } from "@/lib/domain/dates";
import { practicesByDate } from "@/lib/domain/practices";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/server/auth";
import { loadPractices } from "@/server/services/faith";

export const metadata = { title: "Practice history" };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default async function PracticeHistoryPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);
  const g = monthGrid(month);
  const { practices, checkins } = await loadPractices(supabase, user.id, g.from, g.to);
  const byDate = practicesByDate(practices, checkins);
  const days = eachDay(g.from, g.to);
  const selected = sp.day && sp.day >= g.first && sp.day <= g.last ? sp.day : today >= g.first && today <= g.last ? today : null;
  const monthLabel = new Date(`${g.first}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const daysWith = new Set(days.filter((d) => d >= g.first && d <= g.last && byDate.has(d))).size;
  const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/faith">Faith</BackLink>
      <PageHeader title="Practice history" description="The days you made time for your practices. Just a record, never a score." className="mb-2" />

      <section className="rounded-2xl border border-border bg-card p-3" aria-labelledby="ph-month">
        <div className="mb-2 flex items-center justify-between">
          <Link href={`/faith/practices?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="flex size-11 items-center justify-center rounded-lg hover:bg-elevated">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h2 id="ph-month" className="text-base font-semibold">
            {monthLabel}
          </h2>
          <Link href={`/faith/practices?month=${shiftMonth(month, 1)}`} aria-label="Next month" className="flex size-11 items-center justify-center rounded-lg hover:bg-elevated">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="pb-1 text-xs font-medium text-muted-foreground" aria-hidden>
              {d}
            </span>
          ))}
          {days.map((d) => {
            const inMonth = d >= g.first && d <= g.last;
            if (!inMonth) return <span key={d} aria-hidden />;
            const list = byDate.get(d) ?? [];
            return (
              <Link
                key={d}
                href={`/faith/practices?month=${month}&day=${d}`}
                aria-label={`${longDate(d)}: ${list.length ? list.join(", ") : "nothing checked off"}`}
                aria-current={d === selected ? "date" : undefined}
                className={cn(
                  "flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg text-sm tabular-nums",
                  d === today && "ring-1 ring-gold",
                  d === selected && "bg-elevated",
                  list.length ? "font-semibold text-gold-highlight" : "text-foreground/80",
                )}
              >
                <span aria-hidden>{Number(d.slice(8))}</span>
                {list.length > 0 && <span aria-hidden className="mt-0.5 size-1.5 rounded-full bg-gold" />}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {daysWith ? `You made time for your practices on ${daysWith} day${daysWith === 1 ? "" : "s"} in ${monthLabel.split(" ")[0]}.` : "Nothing checked off this month."}
        </p>
      </section>

      {selected && (
        <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="ph-day">
          <h2 id="ph-day" className="font-semibold">
            {longDate(selected)}
          </h2>
          {(byDate.get(selected) ?? []).length ? (
            <ul className="mt-2 list-inside list-disc text-sm">
              {(byDate.get(selected) ?? []).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nothing checked off. Rest and grace are part of the walk too.</p>
          )}
        </section>
      )}
      {!practices.length && (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t chosen any practices yet.{" "}
          <Link href="/faith#practices-title" className="font-semibold text-gold-highlight underline">
            Choose them on the Faith tab
          </Link>
          .
        </p>
      )}
    </div>
  );
}
