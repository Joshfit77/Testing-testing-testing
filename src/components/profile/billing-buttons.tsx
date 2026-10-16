"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { openBillingPortalAction, startCheckoutAction } from "@/server/actions/billing";

export function CheckoutButton({ plan, label, featured, interval = "month" }: { plan: "plus" | "pro"; label: string; featured?: boolean; interval?: "month" | "year" }) {
  const [state, action] = useActionState(startCheckoutAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <SubmitButton className="w-full" variant={featured ? "default" : "secondary"} pendingLabel="Opening checkout…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function PortalButton() {
  const [state, action] = useActionState(openBillingPortalAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary" pendingLabel="Opening…">
        Manage billing
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
