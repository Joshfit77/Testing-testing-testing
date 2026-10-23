"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { allowSleepTrackingAction } from "@/server/actions/sleep";

/** Shown until the member allows storing optional wellness information (the same consent as recovery check-ins). */
export function SleepConsentCard() {
  const [state, action] = useActionState(allowSleepTrackingAction, initialActionState);
  return (
    <section className="rounded-2xl border border-gold/40 bg-card p-5" aria-labelledby="sleep-consent-title">
      <h2 id="sleep-consent-title" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
        <ShieldCheck className="size-5 text-gold" aria-hidden /> Before you start
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Sleep times, naps and check-ins are optional wellness information. They are stored in your account, shown only to you, never shared with the AI coach unless you ask it about your sleep, and deleted with your account. You can delete any entry at any time.
      </p>
      <form action={action} className="mt-4 space-y-3">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="consent" className="size-5 accent-gold" aria-describedby={state.fieldErrors?.consent ? "sleep-consent-error" : undefined} />
          <span>I agree to store my sleep and wellness information in my account.</span>
        </label>
        <FieldError id="sleep-consent-error" message={state.fieldErrors?.consent} />
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Saving…">Allow sleep logging</SubmitButton>
      </form>
    </section>
  );
}
