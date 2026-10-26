import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { formatNightDate } from "@/components/sleep/session-list";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { DEFAULT_SLEEP_GOAL_MINUTES, formatDuration, summarizeNights } from "@/lib/domain/sleep";
import { DEBT_BAND_TEXT, DEBT_WINDOW_NIGHTS, SLEEP_DEBT_VERSION, sleepDebt } from "@/lib/domain/sleep-debt";
import { getServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { listSleepSessions } from "@/server/services/sleep";

export const metadata = { title: "Sleep debt" };

const TREND_TEXT = { rising: "Rising over the last week", falling: "Falling over the last week", steady: "About the same as a week ago" } as const;

export default async function SleepDebtPage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  if (!hasFeature(plan, "sleep_analytics")) {
    return <PlanLocked back={{ href: "/progress/sleep", label: "Sleep & Recovery" }} eyebrow="Sleep & Recovery" title="Sleep debt" plan="Pro" description="An estimate of how far behind your sleep goal you are over the last two weeks, night by night, with the maths shown." />;
  }
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const supabase = await getServerSupabase();
  const sessions = await listSleepSessions(supabase, user.id, { fromNight: addDays(today, -(DEBT_WINDOW_NIGHTS - 1)), toNight: today });
  const debt = sleepDebt(summarizeNights(sessions), goal, today);
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Estimated sleep debt" description={`How far behind your ${formatDuration(goal)} goal you are over the last ${DEBT_WINDOW_NIGHTS} nights, from what you logged.`} />

      <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="debt-now-title">
        <h2 id="debt-now-title" className="font-display text-xl font-bold uppercase">
          Right now
        </h2>
        {debt.nightsWithData === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No nights logged in the last two weeks, so there is nothing to estimate from.</p>
        ) : (
          <>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold text-gold-highlight">{formatDuration(debt.debtMinutes)}</span>
              <span className="text-sm text-muted-foreground">behind, estimated</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{DEBT_BAND_TEXT[debt.band]}</p>
            <p className="mt-2 text-sm">
              {debt.trend ? TREND_TEXT[debt.trend] : "Log a few more nights for a trend"} · from {debt.nightsWithData} of {DEBT_WINDOW_NIGHTS} nights
            </p>
          </>
        )}
      </section>

      <section className={card} aria-labelledby="debt-how-title">
        <h2 id="debt-how-title" className="font-display text-xl font-bold uppercase">
          How it adds up (version {SLEEP_DEBT_VERSION})
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A night under your goal adds the whole shortfall. A night over it pays back half of the extra, and only what is still owed: sleeping in doesn&apos;t cancel lost sleep hour for hour. Nights you didn&apos;t log change nothing. Shortfall added: {formatDuration(debt.totalShortfall)}; paid back: {formatDuration(debt.totalRepaid)}. This is an estimate from your entries and your goal, not a measurement, and it is separate from the nightly score.{" "}
          <Link href="/progress/sleep/method" className="underline">
            How it&apos;s worked out
          </Link>
        </p>
      </section>

      <section className={card} aria-labelledby="debt-days-title">
        <h2 id="debt-days-title" className="font-display text-xl font-bold uppercase">
          Night by night
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 font-medium">
                Night
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Asleep
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Change
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Debt
              </th>
            </tr>
          </thead>
          <tbody>
            {debt.days.map((d) => (
              <tr key={d.date} className="border-t border-border">
                <td className="py-1.5">
                  {d.asleep === null ? (
                    <span className="text-muted-foreground">{formatNightDate(d.date)}</span>
                  ) : (
                    <Link href={`/progress/sleep/night/${d.date}`} className="underline-offset-2 hover:underline">
                      {formatNightDate(d.date)}
                    </Link>
                  )}
                </td>
                <td className="py-1.5 text-right">{d.asleep === null ? <span className="text-muted-foreground">not logged</span> : formatDuration(d.asleep)}</td>
                <td className={cn("py-1.5 text-right", d.shortfall ? "text-destructive-foreground" : d.repaid ? "text-success" : "text-muted-foreground")}>{d.shortfall ? `+${formatDuration(d.shortfall)}` : d.repaid ? `−${formatDuration(d.repaid)}` : "—"}</td>
                <td className="py-1.5 text-right font-semibold">{formatDuration(d.debt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
