import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { BackLink } from "@/components/platform/back-link";
import { hasFeature } from "@/lib/domain/plans";
import { DEFAULT_SLEEP_GOAL_MINUTES } from "@/lib/domain/sleep";
import { latestDuePeriod } from "@/lib/domain/weekly-report";
import { isValidTimeZone } from "@/lib/domain/dates";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { ensureWeeklyReport, listWeeklyReports } from "@/server/services/weekly-reports";
import { formatWeek } from "@/components/reports/format";

export const metadata = { title: "Weekly reports" };
export const dynamic = "force-dynamic";

export default async function WeeklyReportsPage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  const pro = hasFeature(plan, "weekly_reports");
  const supabase = await getServerSupabase();
  const tz = isValidTimeZone(profile.timezone) ? profile.timezone! : "UTC";

  // Pro: make sure the latest due week has its report (the hourly job normally creates it first).
  let failed = false;
  if (pro) {
    try {
      await ensureWeeklyReport(supabase, user.id, plan, latestDuePeriod(new Date(), tz), tz, profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES);
    } catch (err) {
      failed = true;
      logError("weekly_report.page", err);
    }
  }
  // Earlier reports stay readable (and deletable) on any plan: they're the member's data.
  const reports = await listWeeklyReports(supabase, user.id);

  return (
    <div className="space-y-6">
      <BackLink href="/progress">Progress</BackLink>
      <PageHeader
        eyebrow="Pro"
        title="Weekly reports"
        description="Every Sunday from 6 pm your time: your training, nutrition, running, sleep and body weight for the week, from your own logs, with three things to focus on next week."
      />
      {!pro && (
        <section className="rounded-2xl border border-gold/40 bg-card p-5" data-testid="reports-locked">
          <h2 className="font-display text-lg font-bold uppercase">Included with Pro All Access</h2>
          <p className="mt-1 text-sm text-muted-foreground">New weekly reports are part of Pro. {reports.length ? "Your earlier reports stay here for you to read or delete." : ""}</p>
          <Link href="/profile/billing" className="mt-3 inline-flex min-h-11 items-center font-semibold text-gold-highlight underline-offset-4 hover:underline">
            See plans
          </Link>
        </section>
      )}
      {failed && (
        <p role="alert" className="rounded-xl border border-destructive/50 p-3 text-sm">
          This week&apos;s report couldn&apos;t be prepared just now. Your logs are safe; please try again in a few minutes.
        </p>
      )}
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="reports-empty">
          {pro ? "Your first report appears on Sunday evening. Keep logging workouts, food, runs and sleep this week." : "No reports yet."}
        </p>
      ) : (
        <ul className="space-y-3" data-testid="reports-list">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/progress/reports/${r.week_start}`} className="block min-h-11 rounded-2xl border border-border bg-card p-4 hover:border-gold-muted">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{formatWeek(r.metrics.period.weekStart, r.metrics.period.weekEnd)}</span>
                  {!r.read_at && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold-highlight">New</span>}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {r.metrics.training.workouts} workout{r.metrics.training.workouts === 1 ? "" : "s"}
                  {r.metrics.running.runs ? ` · ${r.metrics.running.distanceKm} km run` : ""}
                  {r.metrics.sleep.nights ? ` · ${r.metrics.sleep.nights} night${r.metrics.sleep.nights === 1 ? "" : "s"} of sleep` : ""}
                  {r.metrics.nutrition.loggedDays ? ` · food on ${r.metrics.nutrition.loggedDays} days` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
