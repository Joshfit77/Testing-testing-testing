import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { TargetWakeForm } from "@/components/sleep/target-wake-form";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { DEFAULT_SLEEP_GOAL_MINUTES, formatClock, formatDuration, summarizeNights } from "@/lib/domain/sleep";
import { clockToMinutes } from "@/lib/domain/sleep-checkins";
import { SLEEP_SCHEDULE_VERSION, sleepWindows } from "@/lib/domain/sleep-schedule";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { listSleepSessions } from "@/server/services/sleep";

export const metadata = { title: "Sleep schedule" };

export default async function SleepSchedulePage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  if (!hasFeature(plan, "sleep_analytics")) {
    return <PlanLocked back={{ href: "/progress/sleep", label: "Sleep & Recovery" }} eyebrow="Sleep & Recovery" title="Sleep schedule" plan="Plus" description="A suggested bedtime and wake-up window from your own nights and goal, how steady your rhythm is, and a gradual plan when your bedtime needs to move." />;
  }
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const supabase = await getServerSupabase();
  const sessions = await listSleepSessions(supabase, user.id, { fromNight: addDays(today, -13), toNight: today });
  const nights = summarizeNights(sessions);
  const targetWake = clockToMinutes(profile.sleep_target_wake ?? null);
  const w = sleepWindows(nights, goal, targetWake);
  const card = "rounded-2xl border border-border bg-card p-5";
  const win = (x: { start: number; end: number }) => `${formatClock(x.start)} – ${formatClock(x.end)}`;

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Sleep schedule" description="Windows worked out from your own nights and goal. They don't measure your body clock; they keep your timing steady, which is what a body clock responds to." />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="bed-window-title">
          <h2 id="bed-window-title" className="font-display text-xl font-bold uppercase">
            Bedtime window
          </h2>
          {w.bedWindow ? (
            <>
              <p className="mt-2 font-display text-3xl font-bold text-gold-highlight">{win(w.bedWindow)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                For {formatDuration(goal)} asleep by {formatClock(w.anchorWake!)}, allowing {formatDuration(w.latencyMinutes)} to fall asleep{w.latencyMinutes === 15 && !nights.some((n) => n.latencyMinutes !== null) ? " (a default; enter when you fall asleep for a better figure)" : " (your typical)"}.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{w.guidance[0]}</p>
          )}
        </section>
        <section className="bg-card-gradient rounded-2xl border border-border p-5" aria-labelledby="wake-window-title">
          <h2 id="wake-window-title" className="font-display text-xl font-bold uppercase">
            Wake-up window
          </h2>
          {w.wakeWindow ? (
            <>
              <p className="mt-2 font-display text-3xl font-bold text-gold-highlight">{win(w.wakeWindow)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.anchorSource === "target" ? "Around the wake time you chose." : `Around your typical wake time over ${w.nights} nights.`}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Set a wake time below, or log three nights.</p>
          )}
        </section>
      </div>

      <section className={card} aria-labelledby="target-title">
        <h2 id="target-title" className="font-display text-xl font-bold uppercase">
          Your wake time
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">Leave it blank to follow your typical wake time; set it when you want the windows to hang off a time you&apos;ve chosen (a work start, a training session).</p>
        <TargetWakeForm value={profile.sleep_target_wake ? profile.sleep_target_wake.slice(0, 5) : null} />
      </section>

      <section className={card} aria-labelledby="consistency-title">
        <h2 id="consistency-title" className="font-display text-xl font-bold uppercase">
          Consistency
        </h2>
        {w.consistency !== null ? (
          <>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-gold-highlight">{w.consistency}</span>
              <span className="text-sm text-muted-foreground">/ 100 over {w.nights} nights</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bedtime moves about ±{w.pattern.bedSpread} min and wake time ±{w.pattern.wakeSpread} min from your typical {formatClock(w.pattern.typicalBed!)} and {formatClock(w.pattern.typicalWake!)}.
            </p>
            {w.weekendShift && (
              <p className="mt-1 text-sm text-muted-foreground">
                Weekdays you get up around {formatClock(w.weekendShift.weekdayWake)}, weekends around {formatClock(w.weekendShift.weekendWake)} ({w.weekendShift.minutes} min apart).
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Needs three nights in the last two weeks.</p>
        )}
      </section>

      {w.adjustment && (
        <section className={card} aria-labelledby="adjust-title">
          <h2 id="adjust-title" className="font-display text-xl font-bold uppercase">
            Getting there gradually
          </h2>
          <p className="mt-2 text-sm">
            Your usual bedtime is {formatClock(w.adjustment.fromBed)}; the window centres on {formatClock(w.adjustment.toBed)}. Move {w.adjustment.direction} by {w.adjustment.minutesPerNight} minutes a night: about {w.adjustment.nights} nights. Keep the wake time fixed throughout; sleepiness at the new bedtime follows the wake time.
          </p>
        </section>
      )}

      <section className={card} aria-labelledby="guidance-title">
        <h2 id="guidance-title" className="font-display text-xl font-bold uppercase">
          What to do
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {w.guidance.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Schedule version {SLEEP_SCHEDULE_VERSION}. Windows are arithmetic on your own times and goal, not a circadian measurement.{" "}
          <Link href="/progress/sleep/method" className="underline">
            How it&apos;s worked out
          </Link>
        </p>
      </section>
    </div>
  );
}
