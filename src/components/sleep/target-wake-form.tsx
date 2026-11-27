"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/common/form-status";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-state";
import { setSleepTargetWakeAction } from "@/server/actions/sleep";

export function TargetWakeForm({ value }: { value: string | null }) {
  const [state, action] = useActionState(setSleepTargetWakeAction, initialActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label htmlFor="target-wake" className="block text-sm font-semibold">
          Wake time to keep (optional)
        </label>
        <Input id="target-wake" name="targetWake" type="time" defaultValue={value ?? ""} className="max-w-40" aria-invalid={Boolean(state.fieldErrors?.targetWake)} aria-describedby={state.fieldErrors?.targetWake ? "target-wake-error" : undefined} />
        <FieldError id="target-wake-error" message={state.fieldErrors?.targetWake} />
      </div>
      <SubmitButton pendingLabel="Saving…" variant="secondary">
        Save
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
