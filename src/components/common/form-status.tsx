"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { useActionToast } from "@/components/ui/toaster";

export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}

/** Success messages pop up as a toast; errors stay next to the form so they're easy to fix. */
export function FormMessage({ state }: { state: ActionState }) {
  useActionToast(state);
  if (!state.message || state.ok) return null;
  return (
    <p role="alert" className="animate-fade-in text-sm text-[#f08a8a]">
      {state.message}
    </p>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-[#f08a8a]">
      {message}
    </p>
  );
}
