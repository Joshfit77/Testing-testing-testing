"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { RISK_ACKNOWLEDGMENT } from "@/lib/legal/versions";
import { acceptCurrentTermsAction } from "@/server/actions/legal";

export function AcceptTermsForm() {
  const [state, action] = useActionState(acceptCurrentTermsAction, initialActionState);
  return (
    <form action={action} className="space-y-4 text-foreground">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="termsAccepted" className="mt-0.5 size-5 accent-[#C9A54C]" />
        <span>I agree to the updated Terms of Service and have read the updated Privacy Policy.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="riskAcknowledged" className="mt-0.5 size-5 accent-[#C9A54C]" />
        <span>{RISK_ACKNOWLEDGMENT.text}</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
    </form>
  );
}
