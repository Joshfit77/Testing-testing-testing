"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { giveAiConsentAction, withdrawAiConsentAction } from "@/server/actions/coach";

/** Shown instead of the chat until the member agrees to share coach requests with the AI provider. */
export function AiConsentCard() {
  const [state, action] = useActionState(giveAiConsentAction, initialActionState);
  return (
    <section aria-labelledby="ai-consent-title" className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-gold" aria-hidden />
        <div>
          <h2 id="ai-consent-title" className="font-display text-xl font-bold uppercase">
            Before you use the AI coach
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The coach is powered by Anthropic, a third-party AI provider. To answer you, each message you send is shared with Anthropic
            along with a summary of your training data.
          </p>
        </div>
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">What is shared with Anthropic</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your message and earlier messages in the same chat</li>
            <li>Approximate age, goal, experience, schedule, equipment and dietary preferences</li>
            <li>Your active program, recent workouts, records, bodyweight, nutrition targets and latest readiness score</li>
            <li>Physical limitation notes, only if you consented to optional wellness information</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">What is never shared</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your email address or name</li>
            <li>Progress photos and body measurements</li>
            <li>Faith journal entries and meal logs</li>
          </ul>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        AI replies are general fitness information, can be wrong, and are not medical advice. You can turn the coach off at any time in
        Profile → Privacy &amp; data. Details are in our{" "}
        <Link href="/legal/privacy#ai-coach" className="text-gold-highlight underline" target="_blank">
          Privacy Policy
        </Link>
        .
      </p>
      <form action={action} className="space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="agree" className="mt-0.5 size-5 accent-[#C9A54C]" aria-describedby="agree-error" />
          <span>I agree to my coach messages and the training data listed above being shared with Anthropic to generate replies.</span>
        </label>
        <FieldError id="agree-error" message={state.fieldErrors?.agree} />
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Saving…">Agree and continue</SubmitButton>
      </form>
    </section>
  );
}

export function WithdrawAiConsentForm() {
  const [state, action] = useActionState(withdrawAiConsentAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary" pendingLabel="Turning off…">
        Turn off AI coach data sharing
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
