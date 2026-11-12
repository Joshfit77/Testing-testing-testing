"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { autoRenewalText } from "@/lib/legal/versions";
import { openBillingPortalAction, startCheckoutAction } from "@/server/actions/billing";

export function CheckoutButton({
  plan,
  label,
  featured,
  interval = "month",
  price,
}: {
  plan: "pro";
  label: string;
  featured?: boolean;
  interval?: "month" | "year";
  /** The price shown, for the auto-renewal consent (the server checks it against Stripe). */
  price: string;
}) {
  const [state, action] = useActionState(startCheckoutAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <label className="flex items-start gap-3 text-left text-xs leading-relaxed text-muted-foreground">
        <input type="checkbox" name="renewalConsent" className="mt-0.5 size-5 shrink-0 accent-[#C9A54C]" />
        <span>{autoRenewalText(price, interval)}</span>
      </label>
      <SubmitButton className="w-full" variant={featured ? "default" : "secondary"} pendingLabel="Opening checkout…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function PortalButton({ label = "Manage billing" }: { label?: string }) {
  const [state, action] = useActionState(openBillingPortalAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="secondary" pendingLabel="Opening…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
