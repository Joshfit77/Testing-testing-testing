import Link from "next/link";
import { Award, ChevronRight, History, LineChart, Moon, PersonStanding, ScanLine } from "lucide-react";
import { MainHeader } from "@/components/shell/main-header";
import { BackLink } from "@/components/platform/back-link";
import { StepsCard } from "@/components/steps/steps-card";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { canUseBodyScan } from "@/lib/domain/body-scan";
import { hasFeature } from "@/lib/domain/plans";
import { DEFAULT_STEP_GOAL } from "@/lib/domain/steps";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { logError } from "@/server/log";
import { getDashboardData } from "@/server/services/dashboard";
import { getStepsDaily, type StepsSummary } from "@/server/services/steps";

export const metadata = { title: "My Progress" };

/** "8-week streak · 1 workout this week": the streak first, so an early-week zero doesn't read as a lapse. */
function progressSubtitle(thisWeek: number, weekStreak: number): string {
  const week = `${thisWeek} workout${thisWeek === 1 ? "" : "s"} this week`;
  return weekStreak > 0 ? `${weekStreak}-week streak · ${week}` : week;
}

export default async function ProgressHubPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await getServerSupabase();
  const today = isoDateInTz(new Date(), profile.timezone);
  const stepsPromise: Promise<StepsSummary | null> = getStepsDaily(supabase, user.id, addDays(today, -6), today).catch((err: unknown) => {
    logError("progress.hub.steps", err);
    return null;
  });
  const [data, steps, plan] = await Promise.all([getDashboardData(supabase, user.id, profile.timezone), stepsPromise, getUserPlan(user.id)]);

  const sections = [
    {
      href: "/progress/overview",
      icon: LineChart,
      title: "Overview",
      body: `${data.workoutsTotal} workout${data.workoutsTotal === 1 ? "" : "s"} · records and trends`,
    },
    {
      href: "/progress/sleep",
      icon: Moon,
      title: "Sleep & Recovery",
      body: "Last night, trends and schedule",
    },
    {
      href: "/progress/body-map",
      icon: PersonStanding,
      title: "Strength & Body Map",
      body: hasFeature(plan, "advanced_analytics") ? "Strength ranks by muscle group" : "Pro: strength ranks by muscle",
    },
    {
      href: "/progress/body-scan",
      icon: ScanLine,
      title: "Body Scan",
      body: canUseBodyScan(plan) ? "Guided photos and measurements" : "Pro: guided photos and measurements",
    },
    {
      href: "/progress/badges",
      icon: Award,
      title: "Badges",
      body: "Milestones earned and what's next",
    },
    { href: "/train/history", icon: History, title: "History", body: "Every completed workout" },
  ];

  return (
    <div className="space-y-4">
      <BackLink href="/profile">You</BackLink>
      {/* The header truncates long titles; this one wraps instead so it never reads "My Progre…". */}
      <MainHeader title={<span className="whitespace-normal">My Progress</span>} subtitle={progressSubtitle(data.workoutsThisWeek, data.weekStreak)} />

      <nav aria-label="My Progress sections" className="space-y-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-gold-muted">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-elevated text-gold">
              <s.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{s.title}</span>
              <span className="block text-sm text-muted-foreground">{s.body}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-gold" aria-hidden />
          </Link>
        ))}
      </nav>

      {steps && (
        <div id="steps" className="scroll-mt-4">
          <StepsCard
            today={today}
            goal={profile.step_goal ?? DEFAULT_STEP_GOAL}
            todaySteps={steps.days.at(-1)?.steps ?? 0}
            todaySource={steps.lastSource}
            week={steps.days}
          />
        </div>
      )}
    </div>
  );
}
