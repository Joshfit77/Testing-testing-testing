"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { MoveSession } from "@/components/calendar/move-session";
import { skipMissedSessionsAction } from "@/server/actions/calendar";

export interface MissedSessionsView {
  missed: { dayId: string; name: string; wasDue: string }[];
  resume: { name: string; date: string } | null;
  canSkip: boolean;
}

const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const DISMISS_KEY = "ngf.missed-dismissed";

/**
 * Tells the member that program sessions came and went, and lets them choose what happens. The calendar already
 * rolls an overdue session forward to today; nothing else changes until the member taps one of the choices:
 * train it today (no change), move it to another day, or skip what was missed and keep the program on its usual days.
 */
export function MissedSessionsCard({ view, today, canReschedule, startHref }: { view: MissedSessionsView; today: string; canReschedule: boolean; startHref: string }) {
  const router = useRouter();
  const first = view.missed[0];
  const signature = first ? `${first.dayId}:${first.wasDue}:${today}` : "";
  const [hidden, setHidden] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      if (signature && window.localStorage.getItem(DISMISS_KEY) === signature) setHidden(true);
    } catch {
      /* storage unavailable: show the card */
    }
  }, [signature]);

  if (!first || hidden) return null;
  const n = view.missed.length;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, signature);
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const skip = async () => {
    if (!view.resume) return;
    const ok = await confirmDialog({
      title: `Skip ${n === 1 ? "this session" : `these ${n} sessions`}?`,
      message: `${view.missed.map((m) => m.name).join(", ")} won't be logged, and your program carries on with ${view.resume.name} on ${fmt(view.resume.date)}. Your workout history doesn't change.`,
      confirmLabel: "Skip and stay on schedule",
    });
    if (!ok) return;
    setStatus(null);
    start(async () => {
      const res = await skipMissedSessionsAction({ firstMissedDayId: first.dayId });
      if (res.ok) {
        // The card goes away once the schedule is back on track, so the confirmation is a toast.
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else {
        setStatus({ ok: false, text: res.message ?? "Couldn't update your schedule." });
      }
    });
  };

  return (
    <section aria-labelledby="missed-title" data-testid="missed-sessions" className="rounded-2xl border border-gold-muted bg-card p-4">
      <div className="flex items-start gap-3">
        <CalendarX2 className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0 space-y-1">
          <h2 id="missed-title" className="font-semibold">
            {n === 1 ? `${first.name} was due ${fmt(first.wasDue)}` : `${n} sessions came and went since your last workout`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {n === 1 ? "It's on today's plan now and the rest of your program moves back. Choose what suits you:" : "The first one is on today's plan now. Choose what suits you:"}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <Button asChild>
          <Link href={startHref} onClick={dismiss}>
            Train it today
          </Link>
        </Button>
        {canReschedule ? (
          <>
            <MoveSession dayId={first.dayId} name={first.name} date={today} minDate={today} />
            {view.canSkip && view.resume && (
              <Button type="button" variant="secondary" onClick={skip} disabled={pending} aria-busy={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Skip {n === 1 ? "it" : `these ${n}`} and stay on schedule
              </Button>
            )}
            {!view.canSkip && n > 1 && (
              <p className="text-sm text-muted-foreground">
                After a longer break, picking up where you left off is the safest choice. If today feels hard, start lighter from Recovery.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Moving or skipping sessions is included with Pro All Access.</p>
        )}
        <Button type="button" variant="ghost" onClick={dismiss}>
          Keep the plan as it is
        </Button>
      </div>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "mt-2 text-sm text-[#5fc49a]" : "mt-2 text-sm text-[#f08a8a]"}>
          {status.text}
        </p>
      )}
    </section>
  );
}
