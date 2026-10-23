"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Moon, Square, SunMedium } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { clockMinutesInTz, formatClock, formatDuration, minutesBetween, type SleepSession } from "@/lib/domain/sleep";
import { sleepTimerAction } from "@/server/actions/sleep";

function deviceZone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

/** Start a night or nap timer when going to bed; stop it on getting up. Nothing is measured: it records the two times. */
export function SleepTimerCard({ running, timezone, disabled }: { running: SleepSession | null; timezone: string; disabled?: boolean }) {
  const [state, action] = useActionState(sleepTimerAction, initialActionState);
  const id = useMemo(() => crypto.randomUUID(), []);
  const zone = useMemo(() => deviceZone(timezone), [timezone]);
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(t);
  }, [running]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="sleep-timer-title">
      <h2 id="sleep-timer-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
        <Moon className="size-5 text-gold" aria-hidden /> Sleep timer
      </h2>
      {running ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {running.kind === "nap" ? "Napping" : "In bed"} since <strong className="text-foreground">{formatClock(clockMinutesInTz(running.startedAt, running.timezone))}</strong> ·{" "}
            {formatDuration(Math.max(0, minutesBetween(running.startedAt, now)))} so far
          </p>
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="op" value="stop" />
            <input type="hidden" name="id" value={running.id} />
            <FormMessage state={state} />
            <SubmitButton pendingLabel="Stopping…" className="w-full">
              <Square className="size-4" aria-hidden /> I&apos;m up — stop the timer
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Tap when you get into bed and again when you get up. It records those two times — nothing is listened to or measured.</p>
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="op" value="start" />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="timezone" value={zone} />
            <FormMessage state={state} />
            <div className="grid grid-cols-2 gap-2">
              <SubmitButton name="kind" value="night" pendingLabel="Starting…" disabled={disabled}>
                <Moon className="size-4" aria-hidden /> Going to bed
              </SubmitButton>
              <SubmitButton name="kind" value="nap" variant="secondary" pendingLabel="Starting…" disabled={disabled}>
                <SunMedium className="size-4" aria-hidden /> Starting a nap
              </SubmitButton>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
