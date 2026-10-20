"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, Check, Flag, Loader2, Lock, PartyPopper, RotateCcw } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Notice } from "@/components/common/states";
import { DevotionalContent } from "@/components/faith/devotional-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CHALLENGE_DAYS, CHALLENGE_NAME, devotionalForDay } from "@/data/devotionals";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { challengeDays, completedDayCount, type ChallengeCheckin, type ChallengeDay } from "@/lib/domain/challenge";
import { cn } from "@/lib/utils";
import { leaveChallengeAction, restartChallengeAction, saveChallengeCheckinAction, startChallengeAction } from "@/server/actions/challenge";

export interface FaithChallengeProps {
  today: string;
  /** Devotional shown to users who aren't enrolled (rotates by date). */
  rotatingDay: number;
  enrollment: { id: string; startedOn: string } | null;
  currentDay: number | null;
  checkins: ChallengeCheckin[];
  /** Dates (user's time zone) with a completed workout since the challenge started. */
  workoutDates: string[];
  lastCompletedAt: string | null;
}

type DialogState = { kind: "start" } | { kind: "read" } | { kind: "day"; day: number } | { kind: "leave" } | { kind: "restart" } | null;

function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const STATUS_LABEL: Record<ChallengeDay["status"], string> = {
  done: "done",
  today: "today",
  missed: "not finished yet — you can catch up",
  upcoming: "upcoming",
};

export function FaithChallenge({ today, rotatingDay, enrollment, currentDay, checkins, workoutDates, lastCompletedAt }: FaithChallengeProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  const enrolled = Boolean(enrollment && currentDay);
  const todaysDevotional = devotionalForDay(enrolled ? currentDay! : rotatingDay);
  const days = enrollment ? challengeDays(enrollment.startedOn, today, checkins) : [];
  const doneCount = completedDayCount(checkins);
  const byDay = new Map(checkins.map((c) => [c.day_number, c]));
  const workoutSet = new Set(workoutDates);

  const run = (action: (fd: FormData) => Promise<ActionState>) =>
    startTransition(async () => {
      const res = await action(new FormData());
      setResult(res);
      if (res.ok) {
        setDialog(null);
        router.refresh();
      }
    });

  const closeDialog = (open: boolean) => {
    if (!open) {
      setDialog(null);
      setResult(null);
    }
  };

  const dayDialog = dialog?.kind === "day" && enrollment ? days.find((d) => d.day === dialog.day) : undefined;

  return (
    <>
      {/* Today's devotional */}
      <section id="todays-devotional" className="rounded-2xl border border-gold-muted/50 bg-card p-5 md:p-6" aria-labelledby="devotional-title">
        <p className="text-sm font-semibold text-gold">
          {enrolled ? `Today's devotional · Day ${currentDay} of ${CHALLENGE_DAYS}` : "Today's devotional"}
        </p>
        <h2 id="devotional-title" className="mt-2 font-display text-2xl font-bold uppercase leading-tight">
          {todaysDevotional.title}
        </h2>
        <p className="mt-1 text-xs font-semibold text-gold">{todaysDevotional.reference} (KJV)</p>
        <p className="mt-3 line-clamp-3 text-sm italic text-foreground/85">&ldquo;{todaysDevotional.scripture}&rdquo;</p>
        <div className="mt-4">
          <Button onClick={() => setDialog(enrolled ? { kind: "day", day: currentDay! } : { kind: "read" })}>
            <BookOpenText aria-hidden /> Read today&apos;s devotional
          </Button>
        </div>
      </section>

      {/* Challenge */}
      <section id="challenge" className="bg-card-gradient rounded-2xl border border-border p-5 md:p-6" aria-labelledby="challenge-title">
        <p className="text-sm font-semibold text-gold">Faith &amp; fitness challenge</p>
        <h2 id="challenge-title" className="mt-2 font-display text-2xl font-bold uppercase leading-tight">
          {CHALLENGE_NAME}
        </h2>

        {enrollment && currentDay ? (
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">
                  Day {currentDay} of {CHALLENGE_DAYS}
                </span>
                <span className="text-muted-foreground">
                  {doneCount} of {CHALLENGE_DAYS} days complete
                </span>
              </div>
              <ProgressBar value={(doneCount / CHALLENGE_DAYS) * 100} label="Challenge progress" />
            </div>

            <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10" aria-label="Challenge days">
              {days.map((d) => {
                const label = `Day ${d.day}, ${STATUS_LABEL[d.status]}${d.partial ? ", partly checked off" : ""}`;
                const cls = cn(
                  "relative flex min-h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors",
                  d.status === "done" && "border-gold bg-gold-gradient text-primary-foreground",
                  d.status === "today" && "border-2 border-gold-highlight bg-gold/10 text-gold-highlight",
                  d.status === "missed" && "border-dashed border-gold-muted/70 text-muted-foreground hover:border-gold-highlight hover:text-foreground",
                  d.status === "upcoming" && "border-border bg-elevated/40 text-muted-foreground/60",
                );
                return (
                  <li key={d.day}>
                    {d.status === "upcoming" ? (
                      <span className={cls} title={label}>
                        <span className="sr-only">{label}</span>
                        <span aria-hidden>{d.day}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={cn(cls, "w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight")}
                        aria-label={label}
                        title={label}
                        aria-current={d.status === "today" ? "date" : undefined}
                        onClick={() => setDialog({ kind: "day", day: d.day })}
                      >
                        {d.status === "done" ? <Check className="size-4" aria-hidden /> : d.day}
                        {d.partial && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-gold" aria-hidden />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>

            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-gold" aria-hidden /> Done
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded border-2 border-gold-highlight" aria-hidden /> Today
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-dashed border-gold-muted" aria-hidden /> Catch up
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-elevated" aria-hidden /> Upcoming
              </li>
            </ul>

            {currentDay === CHALLENGE_DAYS && doneCount < CHALLENGE_DAYS && (
              <p className="text-sm text-muted-foreground">You&apos;ve reached day 40. Catch up on any open days to finish the challenge.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDialog({ kind: "day", day: currentDay })}>Open day {currentDay}</Button>
              <Button variant="ghost" onClick={() => setDialog({ kind: "restart" })}>
                <RotateCcw aria-hidden /> Restart
              </Button>
              <Button variant="ghost" onClick={() => setDialog({ kind: "leave" })}>
                <Flag aria-hidden /> Leave challenge
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {lastCompletedAt && (
              <Notice tone="success">
                <span className="flex items-start gap-2">
                  <PartyPopper className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  <span>
                    You walked all 40 days through the narrow gate — finished {formatDate(lastCompletedAt)}. Give thanks for His grace along the way, and keep
                    walking one faithful day at a time.
                  </span>
                </span>
              </Notice>
            )}
            <p className="max-w-2xl text-sm text-muted-foreground">
              Forty days of scripture, a short devotional, a one-line prayer and a training prompt. Check off your reading and your training each day, and
              catch up whenever life gets in the way. Grace, not perfection.
            </p>
            <Button onClick={() => setDialog({ kind: "start" })}>{lastCompletedAt ? "Start the challenge again" : "Start the challenge"}</Button>
          </div>
        )}
      </section>

      {/* Read-only devotional (not enrolled) */}
      <Dialog open={dialog?.kind === "read"} onOpenChange={closeDialog}>
        <DialogContent side="bottom">
          <DialogHeader>
            <p className="text-sm font-semibold text-gold">Today&apos;s devotional</p>
            <DialogTitle>{todaysDevotional.title}</DialogTitle>
            <DialogDescription>{todaysDevotional.reference}</DialogDescription>
          </DialogHeader>
          <DevotionalContent devotional={todaysDevotional} />
          <div className="mt-5 rounded-xl border border-border bg-elevated/50 p-4">
            <p className="text-sm text-muted-foreground">Want a daily rhythm? Walk through all 40 devotionals with the challenge.</p>
            <Button className="mt-3" variant="outline" onClick={() => setDialog({ kind: "start" })}>
              Learn about the challenge
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Start */}
      <Dialog open={dialog?.kind === "start"} onOpenChange={closeDialog}>
        <DialogContent side="bottom">
          <DialogHeader>
            <DialogTitle>{CHALLENGE_NAME}</DialogTitle>
            <DialogDescription>A daily faith &amp; fitness rhythm, inspired by Matthew 7:13–14.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/90">
            <li>Each day brings a King James scripture, a short devotional, a one-line prayer, a training prompt and a reflection question.</li>
            <li>Check off two things: reading the devotional, and training — your scheduled workout, or a walk and mobility on rest days.</li>
            <li>Day 1 is today. Missed a day? Catch up whenever you can — the challenge is finished when all 40 days are checked off.</li>
            <li>
              Add a note to any day if you like. <Lock className="inline size-3.5 text-gold" aria-hidden /> Notes are private to you.
            </li>
            <li>You can restart or leave at any time. God&apos;s love doesn&apos;t depend on your streak.</li>
          </ul>
          {result && !result.ok && <div className="mt-4"><FormMessage state={result} /></div>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => run(startChallengeAction)} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Begin day 1
            </Button>
            <Button variant="ghost" onClick={() => closeDialog(false)}>
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave / restart confirmation */}
      <Dialog open={dialog?.kind === "leave" || dialog?.kind === "restart"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.kind === "restart" ? "Restart the challenge?" : "Leave the challenge?"}</DialogTitle>
            <DialogDescription>
              {dialog?.kind === "restart"
                ? "You'll begin again at day 1 today. Your current progress will no longer be shown."
                : "Your current progress will no longer be shown. You can start again whenever you're ready."}
            </DialogDescription>
          </DialogHeader>
          {result && !result.ok && <FormMessage state={result} />}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant={dialog?.kind === "restart" ? "default" : "destructive"}
              onClick={() => run(dialog?.kind === "restart" ? restartChallengeAction : leaveChallengeAction)}
              disabled={pending}
              aria-busy={pending}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {dialog?.kind === "restart" ? "Restart at day 1" : "Leave challenge"}
            </Button>
            <Button variant="ghost" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day */}
      <Dialog open={Boolean(dayDialog)} onOpenChange={closeDialog}>
        <DialogContent side="bottom">
          {dayDialog && enrollment && (
            <DayView
              key={`${enrollment.id}-${dayDialog.day}`}
              enrollmentId={enrollment.id}
              day={dayDialog}
              isToday={dayDialog.day === currentDay && dayDialog.date === today}
              checkin={byDay.get(dayDialog.day)}
              workoutFound={workoutSet.has(dayDialog.date)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DayView({
  enrollmentId,
  day,
  isToday,
  checkin,
  workoutFound,
}: {
  enrollmentId: string;
  day: ChallengeDay;
  isToday: boolean;
  checkin: ChallengeCheckin | undefined;
  workoutFound: boolean;
}) {
  const [state, action] = useActionState(saveChallengeCheckinAction, initialActionState);
  const devotional = devotionalForDay(day.day);
  const suggestWorkout = !checkin && workoutFound;
  const noteId = `challenge-note-${day.day}`;
  return (
    <>
      <DialogHeader>
        <p className="text-sm font-semibold text-gold">
          Day {day.day} of {CHALLENGE_DAYS} · {isToday ? "Today" : formatDate(day.date)}
        </p>
        <DialogTitle>{devotional.title}</DialogTitle>
        <DialogDescription>{devotional.reference}</DialogDescription>
      </DialogHeader>
      <DevotionalContent devotional={devotional} />

      <form action={action} className="mt-5 space-y-3 border-t border-border pt-4">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="dayNumber" value={day.day} />
        <p className="text-sm font-semibold">{isToday ? "Check in for today" : `Catch up on day ${day.day}`}</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-elevated/50 px-3 py-2">
          <input type="checkbox" name="devotionalDone" defaultChecked={checkin?.devotional_done ?? false} className="size-5 accent-[#C9A54C]" />
          <span className="text-sm">{isToday ? "Read today's devotional" : "Read this devotional"}</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-elevated/50 px-3 py-2">
          <input type="checkbox" name="workoutDone" defaultChecked={checkin?.workout_done ?? suggestWorkout} className="size-5 accent-[#C9A54C]" />
          <span className="text-sm">{isToday ? "Trained today" : `Trained on ${formatDate(day.date)}`}</span>
        </label>
        {suggestWorkout && (
          <p className="text-xs text-gold-highlight">
            We found a completed workout {isToday ? "today" : "on this day"}, so this is pre-checked. Save to confirm.
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor={noteId}>Note (optional)</Label>
          <Textarea
            id={noteId}
            name="note"
            maxLength={1000}
            defaultValue={checkin?.note ?? ""}
            placeholder={devotional.reflection}
            className="min-h-24"
            aria-invalid={Boolean(state.fieldErrors?.note)}
          />
          <FieldError message={state.fieldErrors?.note} />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Private to you.
          </p>
        </div>
        <FormMessage state={state} />
        <SubmitButton className="w-full sm:w-auto">Save check-in</SubmitButton>
      </form>
    </>
  );
}
