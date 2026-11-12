"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Circle, CloudOff, HandHeart, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { CHECKIN_QUEUE_EVENT, flushCheckinQueue, readCheckinQueue, writeCheckinQueue, type CheckinActivity } from "@/lib/faith/checkin-queue";
import { cn } from "@/lib/utils";
import { journeyCheckInAction, journeyUndoAction, type CheckInResult } from "@/server/actions/journeys";

type Activity = CheckinActivity;

/**
 * Today's two required activities. Each is marked complete only when the member taps it. Without a connection the
 * tap is kept on this device with its time and sent when the connection returns; the server counts it only for the
 * day it happened, and only if it arrives before that day closes (midnight, plus three hours for a phone that was
 * offline). Otherwise the member is told it didn't count; nothing is moved to another day.
 */
export function JourneyCheckIn({
  userId,
  journeyId,
  day,
  reading,
  prayer,
  readingHref,
  minutes,
  only,
}: {
  userId: string;
  journeyId: string;
  day: number;
  reading: boolean;
  prayer: boolean;
  readingHref: string | null;
  minutes: number;
  /** Show just one activity's row (the Bible reader shows the reading row at the end of today's chapter). */
  only?: Activity;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState<Activity[]>([]);

  const send = useCallback(async (activity: Activity, occurredAt: string | null): Promise<CheckInResult | "network"> => {
    try {
      return await journeyCheckInAction(activity, occurredAt);
    } catch {
      return "network";
    }
  }, []);

  const showQueued = useCallback(() => {
    setQueued(
      readCheckinQueue(userId)
        .filter((p) => p.journeyId === journeyId)
        .map((p) => p.activity),
    );
  }, [journeyId, userId]);

  // The app shell sends the queue too (on any screen); both share one run, so nothing is sent or announced twice.
  const flush = useCallback(async () => {
    if (!navigator.onLine || !readCheckinQueue(userId).length) return;
    const r = await flushCheckinQueue(userId, { journeyId, send, notify: (tone, message) => toast[tone](message) });
    if (r.changed) router.refresh();
  }, [journeyId, router, send, userId]);

  useEffect(() => {
    showQueued();
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    window.addEventListener(CHECKIN_QUEUE_EVENT, showQueued);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(CHECKIN_QUEUE_EVENT, showQueued);
    };
  }, [flush, showQueued]);

  function mark(activity: Activity) {
    const occurredAt = new Date().toISOString();
    const queue = () => {
      const q = readCheckinQueue(userId).filter((p) => !(p.journeyId === journeyId && p.activity === activity));
      writeCheckinQueue(userId, [...q, { journeyId, activity, occurredAt }]);
      toast.info("You're offline. Saved on this device; it will count when you reconnect, if that's before 3 a.m.");
    };
    if (!navigator.onLine) return queue();
    start(async () => {
      const r = await send(activity, null);
      if (r === "network") return queue();
      if (!r.ok) return toast.error(r.error);
      toast.success(r.reading && r.prayer ? `Day ${r.day} complete.` : activity === "reading" ? "Bible reading marked complete." : "Prayer marked complete.");
      router.refresh();
    });
  }

  function undo(activity: Activity) {
    start(async () => {
      const r = await journeyUndoAction(activity).catch(() => ({ ok: false }));
      if (!r.ok) return toast.error("Couldn't undo. Check your connection.");
      router.refresh();
    });
  }

  const allRows: { id: Activity; done: boolean; title: string; detail: string; icon: typeof BookOpen }[] = [
    { id: "reading", done: reading, title: "Today's Bible reading", detail: `About ${minutes} min`, icon: BookOpen },
    { id: "prayer", done: prayer, title: "Prayer", detail: "Time with God in prayer. Writing it down is optional.", icon: HandHeart },
  ];
  const rows = allRows.filter((r) => !only || r.id === only);

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const isQueued = !r.done && queued.includes(r.id);
        return (
          <div key={r.id} className={cn("rounded-2xl border p-3", r.done ? "border-gold-muted bg-gold/8" : "border-border bg-elevated/50")}>
            <div className="flex items-start gap-3">
              {r.done ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden /> : isQueued ? <CloudOff className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden /> : <Circle className="mt-0.5 size-6 shrink-0 text-muted-foreground" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.done ? "Done for today." : isQueued ? "Saved on this device; waiting for a connection." : r.detail}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.id === "reading" && readingHref && (
                    <Button asChild size="sm" variant="secondary">
                      <Link href={readingHref}>
                        <BookOpen aria-hidden /> Read
                      </Link>
                    </Button>
                  )}
                  {r.id === "prayer" && (
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/faith/journal/new?kind=daily&from=journey">
                        <HandHeart aria-hidden /> Write a prayer
                      </Link>
                    </Button>
                  )}
                  {r.done ? (
                    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => undo(r.id)}>
                      <Undo2 aria-hidden /> Undo
                    </Button>
                  ) : (
                    !isQueued && (
                      <Button type="button" size="sm" className="h-auto min-h-9 whitespace-normal py-1.5 text-left" disabled={pending} onClick={() => mark(r.id)}>
                        <CheckCircle2 aria-hidden /> {r.id === "reading" ? (only === "reading" ? "Mark today's reading complete" : "Mark reading complete") : "Mark prayer complete"}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {reading && prayer ? `Day ${day} is complete. Well done.` : "Both are needed before midnight (your time) to keep going."}
      </p>
    </div>
  );
}
