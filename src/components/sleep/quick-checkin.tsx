"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { RATING_LABELS } from "@/lib/domain/sleep-checkins";
import { quickRestednessAction } from "@/server/actions/sleep-checkins";

/** One tap on the dashboard: how rested do you feel this morning? Links to the full check-in. */
export function QuickCheckin({ day, restedness }: { day: string; restedness: number | null }) {
  const [state, action] = useActionState(quickRestednessAction, initialActionState);
  const r = RATING_LABELS.restedness;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="day" value={day} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{r.label}</legend>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="submit"
              name="restedness"
              value={n}
              aria-pressed={restedness === n}
              className="flex h-11 items-center justify-center rounded-xl border border-border bg-elevated text-sm font-semibold hover:border-gold-muted aria-pressed:border-gold aria-pressed:bg-gold/15 aria-pressed:text-gold-highlight"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
          <span>{r.low}</span>
          <span>{r.high}</span>
        </div>
      </fieldset>
      <FormMessage state={state} />
      <Link href={`/progress/sleep/checkin?day=${day}`} className="inline-block text-sm font-semibold text-gold-highlight underline">
        {restedness === null ? "Full check-in (optional)" : "Add more to today's check-in"}
      </Link>
    </form>
  );
}
