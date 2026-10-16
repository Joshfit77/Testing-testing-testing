"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/form-status";
import { initialActionState, type ActionState } from "@/lib/action-state";

/** Generic form bound to a server action returning ActionState. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className={className ?? "space-y-3"} key={resetOnSuccess && state.ok ? state.at : undefined}>
      {children}
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
        <ul className="text-xs text-[#f08a8a]">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      )}
      <FormMessage state={state} />
      <SubmitButton size="sm">{submitLabel}</SubmitButton>
    </form>
  );
}
