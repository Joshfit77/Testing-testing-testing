import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { PlanLocked } from "@/components/common/plan-locked";
import { BackLink } from "@/components/platform/back-link";
import { addDays, isoDateInTz } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { clockMinutesInTz, DEFAULT_SLEEP_GOAL_MINUTES, formatClock, summarizeNights } from "@/lib/domain/sleep";
import { clockToMinutes, RATING_LABELS } from "@/lib/domain/sleep-checkins";
import { sleepDebt } from "@/lib/domain/sleep-debt";
import { energyRhythm, SLEEP_ENERGY_VERSION } from "@/lib/domain/sleep-energy";
import { sleepWindows } from "@/lib/domain/sleep-schedule";
import { getServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getUserPlan, requireOnboardedUser } from "@/server/auth";
import { getSleepCheckin, listSleepSessions } from "@/server/services/sleep";

export const metadata = { title: "Daily energy" };

export default async function SleepEnergyPage() {
  const { user, profile } = await requireOnboardedUser();
  const plan = await getUserPlan(user.id);
  if (!hasFeature(plan, "sleep_analytics")) {
    return <PlanLocked back={{ href: "/progress/sleep", label: "Sleep & Recovery" }} eyebrow="Sleep & Recovery" title="Daily energy" plan="Plus" description="An hour-by-hour estimate of when you're likely to feel sharp or flat today, from your wake time, last night and sleep debt, shown next to the energy you actually report." />;
  }
  const tz = profile.timezone ?? "UTC";
  const today = isoDateInTz(new Date(), tz);
  const goal = profile.sleep_goal_minutes ?? DEFAULT_SLEEP_GOAL_MINUTES;
  const supabase = await getServerSupabase();
  const [sessions, checkin] = await Promise.all([listSleepSessions(supabase, user.id, { fromNight: addDays(today, -13), toNight: today }), getSleepCheckin(supabase, user.id, today)]);
  const nights = summarizeNights(sessions);
  const lastNight = nights.find((n) => n.nightOf === today) ?? null;
  const w = sleepWindows(nights, goal, clockToMinutes(profile.sleep_target_wake ?? null));
  // Today's curve hangs off this morning's actual wake time when it was logged, else the member's usual one.
  const wakeMinutes = lastNight ? clockMinutesInTz(lastNight.wakeAt, lastNight.timezone) : (w.anchorWake ?? 7 * 60);
  const bedMinutes = w.bedWindow ? Math.round((w.bedWindow.start + 30) % 1440) : (wakeMinutes + 16 * 60) % 1440;
  const debt = sleepDebt(nights, goal, today);
  const r = energyRhythm(wakeMinutes, bedMinutes, lastNight?.asleepMinutes ?? null, goal, debt.nightsWithData ? debt.debtMinutes : 0);
  const reported = [
    ["energy_morning", checkin?.energy_morning ?? null],
    ["energy_afternoon", checkin?.energy_afternoon ?? null],
    ["energy_evening", checkin?.energy_evening ?? null],
  ] as const;
  const card = "rounded-2xl border border-border bg-card p-5";
  const win = (x: { start: number; end: number }) => `${formatClock(x.start)}–${formatClock(x.end)}`;

  return (
    <div className="space-y-6">
      <BackLink href="/progress/sleep">Sleep & Recovery</BackLink>
      <PageHeader eyebrow="Sleep & Recovery" title="Daily energy" description="An estimate of how alert you're likely to feel through today, and what you actually reported. Two different things, shown together on purpose." />

      <section className={card} aria-labelledby="curve-title">
        <h2 id="curve-title" className="font-display text-xl font-bold uppercase">
          Estimated alertness today
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From a {formatClock(wakeMinutes)} wake time{lastNight ? `, last night's ${Math.round(lastNight.asleepMinutes / 6) / 10} h` : ", no night logged"}
          {debt.nightsWithData ? ` and an estimated ${Math.round(debt.debtMinutes / 6) / 10} h of sleep debt` : ""}
          {r.scale < 1 ? ` (curve lowered to ${Math.round(r.scale * 100)}%)` : ""}.
        </p>
        <ol className="mt-4 flex h-32 items-end gap-0.5" aria-label="Estimated alertness by hour">
          {r.points.map((p) => (
            <li key={p.minute} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="sr-only">
                {formatClock(p.minute)}: {p.level === null ? "asleep" : `${p.level} out of 100`}
              </span>
              <span aria-hidden className={cn("w-full rounded-t", p.level === null ? "h-1 bg-elevated" : p.level >= 80 ? "bg-gold-gradient" : p.level >= 65 ? "bg-champagne" : "bg-bronze")} style={{ height: `${p.level === null ? 4 : Math.max(6, p.level)}%` }} />
              {p.minute % 360 === 0 && (
                <span aria-hidden className="text-[0.625rem] text-muted-foreground">
                  {formatClock(p.minute).replace(":00", "")}
                </span>
              )}
            </li>
          ))}
        </ol>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-elevated p-3">
            <dt className="text-xs text-muted-foreground">Likely sharpest</dt>
            <dd className="font-semibold">{r.peaks.map(win).join(", ") || "—"}</dd>
          </div>
          <div className="rounded-xl bg-elevated p-3">
            <dt className="text-xs text-muted-foreground">Likely flattest</dt>
            <dd className="font-semibold">{r.dips.map(win).join(", ") || "—"}</dd>
          </div>
          <div className="rounded-xl bg-elevated p-3">
            <dt className="text-xs text-muted-foreground">Start winding down</dt>
            <dd className="font-semibold">{formatClock(r.windDown)}</dd>
          </div>
        </dl>
      </section>

      <section className={card} aria-labelledby="reported-title">
        <h2 id="reported-title" className="font-display text-xl font-bold uppercase">
          What you reported today
        </h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          {reported.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-elevated p-3">
              <dt className="text-xs text-muted-foreground">{RATING_LABELS[k].label}</dt>
              <dd className="font-display text-2xl font-bold text-gold-highlight">{v === null ? "—" : `${v}/5`}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/progress/sleep/checkin?day=${today}`} className="mt-3 inline-block text-sm font-semibold text-gold-highlight underline">
          Update today&apos;s check-in
        </Link>
      </section>

      <section className={card} aria-labelledby="assumptions-title">
        <h2 id="assumptions-title" className="font-display text-xl font-bold uppercase">
          Assumptions (version {SLEEP_ENERGY_VERSION})
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {r.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">This does not measure hormones, brain activity or circadian timing. Your reported energy is the real figure; the curve is a sketch to plan around.</p>
      </section>
    </div>
  );
}
