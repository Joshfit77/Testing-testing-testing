"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Textarea } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-state";
import { recoveryCheckinAction } from "@/server/actions/recovery";

const SCALES = [
  { name: "sleepQuality", label: "Sleep quality", low: "Poor", high: "Great" },
  { name: "energy", label: "Energy", low: "Drained", high: "Energized" },
  { name: "soreness", label: "Muscle soreness", low: "None", high: "Very sore" },
  { name: "stress", label: "Stress", low: "Calm", high: "Very stressed" },
] as const;

export function CheckinForm({ needsConsent }: { needsConsent: boolean }) {
  const [state, action] = useActionState(recoveryCheckinAction, initialActionState);
  return (
    <form action={action} className="space-y-5">
      {SCALES.map((s) => (
        <fieldset key={s.name}>
          <legend className="mb-2 text-sm font-semibold">{s.label}</legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name={s.name} value={n} defaultChecked={n === 3} className="peer sr-only" />
                <span className="flex h-11 items-center justify-center rounded-xl border border-border bg-elevated text-sm font-semibold peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:text-gold-highlight peer-focus-visible:ring-2 peer-focus-visible:ring-gold-highlight">
                  {n}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
            <span>{s.low}</span>
            <span>{s.high}</span>
          </div>
        </fieldset>
      ))}
      <div>
        <label htmlFor="checkin-notes" className="text-sm font-semibold">
          Notes (optional)
        </label>
        <Textarea id="checkin-notes" name="notes" maxLength={500} className="mt-2 min-h-16" placeholder="Anything worth remembering about today" />
      </div>
      {needsConsent && (
        <label className="flex items-start gap-3 rounded-xl border border-border bg-elevated/50 p-3 text-sm">
          <input type="checkbox" name="consent" className="mt-0.5 size-5 accent-[#C9A54C]" />
          <span>I consent to storing optional recovery and wellness information to personalize my training. I can delete it at any time.</span>
        </label>
      )}
      <FieldError message={state.fieldErrors?.consent} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save check-in</SubmitButton>
    </form>
  );
}
