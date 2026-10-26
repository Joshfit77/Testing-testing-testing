"use client";

import { useActionState } from "react";
import { FlaskConical } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { enterDemoAction, startFreshDemoAction } from "@/server/actions/demo";

/** Demo deployments only: one tap into the sample account, or a fresh account to try onboarding. */
export function DemoEntry({ className }: { className?: string }) {
  const [enterState, enter] = useActionState(enterDemoAction, initialActionState);
  const [freshState, fresh] = useActionState(startFreshDemoAction, initialActionState);
  return (
    <section className={className} aria-labelledby="demo-entry-title" data-testid="demo-entry">
      <div className="rounded-2xl border border-gold-muted/60 bg-gold/5 p-4 text-left">
        <h2 id="demo-entry-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
          <FlaskConical className="size-4" aria-hidden /> Interactive demo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sample data only. Purchases are turned off and nothing is ever charged. AI replies in this demo are simulated by a script.
        </p>
        <div className="mt-3 grid gap-2">
          <form action={enter}>
            <SubmitButton className="w-full" pendingLabel="Opening the demo…">
              Explore with sample data
            </SubmitButton>
          </form>
          <form action={fresh}>
            <SubmitButton variant="outline" className="w-full" pendingLabel="Creating a demo account…">
              Start as a new member
            </SubmitButton>
          </form>
          <FormMessage state={enterState} />
          <FormMessage state={freshState} />
        </div>
      </div>
    </section>
  );
}
