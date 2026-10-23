import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { formatNightDate } from "@/components/sleep/session-list";
import { analyzeTraining } from "@/lib/domain/adaptive-training";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { DEFAULT_SLEEP_GOAL_MINUTES, formatDuration, summarizeNights } from "@/lib/domain/sleep";
import { sleepTrainingLinks, type TrainingDay } from "@/lib/domain/sleep-training";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { loadReviewInput } from "@/server/services/adaptive-training";
import { listSleepCheckins, listSleepSessions } from "@/server/services/sleep";

export const metadata = { title: "Sleep & training" };

export default async function SleepTrainingPage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  if (!hasFeature(plan, "sleep_ai_coaching")) {
    return <PlanLocked back={{ href: "/progress/sleep", label: "Sleep & Recovery" }} eyebrow="Sleep & Recovery" title="Sleep & training" plan="Pro" description="Your sleep and your training side by side: the nights before workouts, how hard sessions felt after short nights, how rested you said you were, and the training review's sleep-aware suggestions, which you accept or decline." />;
  }
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const supabase = await getServerSupabase();
  const [{ input }, sessions, checkins] = await Promise.all([loadReviewInput(supabase, user.id), listSleepSessions(supabase, user.id, { fromNight: addDays(today, -55), toNight: today }), listSleepCheckins(supabase, user.id, addDays(today, -55), today)]);
  const nights = summarizeNights(sessions);
  const training: TrainingDay[] = input.workouts.map((w) => {
    const rpes = w.exercises.flatMap((e) => e.sets.map((s) => s.rpe).filter((r): r is number => r != null));
    return { date: w.date, avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null, sets: w.exercises.reduce((a, e) => a + e.sets.length, 0) };
  });
  const links = sleepTrainingLinks(nights, training, checkins, goal);
  const review = analyzeTraining(input);
  const sleepRecs = review.recommendations.filter((r) => r.kind === "short_sleep" || r.kind === "low_readiness" || r.kind === "deload");
  const week = nights.filter((n) => n.nightOf >= addDays(today, -6));
  const trainedThisWeek = training.filter((t) => t.date >= addDays(today, -6)).length;
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Sleep & training" description="Your own logs, side by side. Patterns here are associations, not causes, and nothing changes your program unless you accept it." />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="bg-card-gradient rounded-2xl border border-border p-5">
          <h2 className="font-display text-xl font-bold uppercase">This week</h2>
          <p className="mt-2 text-sm">
            <span className="font-display text-3xl font-bold text-gold-highlight">{week.length ? formatDuration(Math.round(week.reduce((a, n) => a + n.asleepMinutes, 0) / week.length)) : "—"}</span>{" "}
            <span className="text-muted-foreground">average asleep over {week.length} logged {week.length === 1 ? "night" : "nights"}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {trainedThisWeek} workout{trainedThisWeek === 1 ? "" : "s"} in the last 7 days · goal {formatDuration(goal)}
          </p>
        </section>
        <section className={card}>
          <h2 className="font-display text-xl font-bold uppercase">Suggestions</h2>
          {sleepRecs.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {sleepRecs.map((r) => (
                <li key={r.key} className="rounded-xl bg-elevated p-3">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-muted-foreground">{r.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.why.join(" ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nothing sleep-related to suggest right now.</p>
          )}
          <Link href="/train/review" className="mt-3 inline-block text-sm font-semibold text-gold-highlight underline">
            Open the training review
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Suggestions with a change attached wait for your Accept there; the rest are advice only.</p>
        </section>
      </div>

      <section className={card} aria-labelledby="links-title">
        <h2 id="links-title" className="font-display text-xl font-bold uppercase">
          In your own logs
        </h2>
        {links.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.key} className="rounded-xl bg-elevated p-3">
                {l.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Comparisons appear once there are at least three nights on each side (nights before a workout and other nights; short nights and nights near your goal, with logged RPE or a morning check-in) and a real difference between them. Keep logging both and they fill in.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">A sleep score is not a recovery measure, and short sleep alone does not predict injury. If you feel unwell or have pain, rest and talk to a qualified professional.</p>
      </section>

      {nights.length > 0 && (
        <section className={card} aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-display text-xl font-bold uppercase">
            Last 14 nights and the days after
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
                  Trained
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Avg RPE
                </th>
              </tr>
            </thead>
            <tbody>
              {nights
                .filter((n) => n.nightOf >= addDays(today, -13))
                .map((n) => {
                  const t = training.find((x) => x.date === n.nightOf);
                  return (
                    <tr key={n.nightOf} className="border-t border-border">
                      <td className="py-1.5">
                        <Link href={`/progress/sleep/night/${n.nightOf}`} className="underline-offset-2 hover:underline">
                          {formatNightDate(n.nightOf)}
                        </Link>
                      </td>
                      <td className="py-1.5 text-right">{formatDuration(n.asleepMinutes)}</td>
                      <td className="py-1.5 text-right">{t ? `${t.sets} sets` : "rest"}</td>
                      <td className="py-1.5 text-right">{t?.avgRpe ?? "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
