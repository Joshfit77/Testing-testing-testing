"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { JOURNEY_RULE, RULE_GRACE } from "@/lib/faith/journey-copy";
import { enrollJourneyAction } from "@/server/actions/journeys";

/** The last step: start date, the daily rule (which must be acknowledged) and Begin. */
export function JourneyEnrollForm({ kind, param, days, today, maxStart, replacing }: { kind: string; param: string | null; days: number; today: string; maxStart: string; replacing: string | null }) {
  const [state, action, pending] = useActionState(enrollJourneyAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      {param && <input type="hidden" name="param" value={param} />}
      <input type="hidden" name="days" value={days} />
      <div className="space-y-1.5">
        <Label htmlFor="journey-start">Start date</Label>
        <Input id="journey-start" name="start" type="date" required defaultValue={today} min={today} max={maxStart} className="max-w-[12rem]" />
        <p className="text-sm text-muted-foreground">Today or any day in the next 30 days. Day 1 is the day you choose.</p>
      </div>
      <div className="rounded-2xl border border-gold-muted bg-gold/8 p-4">
        <p className="font-semibold">The daily rule</p>
        <p className="mt-1 text-[0.9375rem]">Each day: read that day&rsquo;s passage and pray, and mark both complete.</p>
        {/* The rule and its grace line together, with equal weight. */}
        <p className="mt-2 text-[0.9375rem]">{JOURNEY_RULE}</p>
        <p className="mt-2 text-[0.9375rem]">{RULE_GRACE}</p>
        <p className="mt-2 text-sm text-muted-foreground">Days end at midnight in your time zone.</p>
        <label className="mt-3 flex min-h-11 items-start gap-3 text-[0.9375rem]">
          <input type="checkbox" name="accept" required className="mt-1 size-5 shrink-0 accent-[var(--gold)]" />
          <span>I understand that missing a day&rsquo;s reading or prayer restarts this journey at Day 1.</span>
        </label>
      </div>
      {replacing && <p className="text-sm text-muted-foreground">Starting this journey ends your current one ({replacing}). Its record, your reading history and your notes stay saved.</p>}
      {state.message && !state.ok && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} Begin the journey
      </Button>
    </form>
  );
}
