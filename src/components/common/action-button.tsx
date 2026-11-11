"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";

/** What an action may report back. Actions that return nothing are treated as having succeeded. */
export type ActionButtonResult = void | { ok: boolean; error?: string; message?: string };

/**
 * A button that invokes a server action with fixed fields, then refreshes the current route.
 * Used for simple one-click mutations (toggle, delete, mark done) rendered by server components.
 * When the action reports `{ ok: false }`, or the request itself fails (offline), a message is shown and the
 * button neither navigates nor refreshes, so a failed delete never looks like it worked.
 */
export function ActionButton({
  action,
  fields,
  children,
  navigateTo,
  confirmMessage,
  confirmLabel,
  confirmDetail,
  ...props
}: Omit<ButtonProps, "onClick" | "type"> & {
  action: (formData: FormData) => Promise<ActionButtonResult>;
  fields: Record<string, string>;
  /** Navigate here after success instead of refreshing in place. */
  navigateTo?: string;
  confirmMessage?: string;
  /** Label for the confirm button (defaults to "Delete" for destructive buttons, else "Confirm"). Setting it marks the action destructive. */
  confirmLabel?: string;
  /** Optional second line in the confirm dialog. */
  confirmDetail?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      onClick={async () => {
        const destructive = props.variant === "destructive" || Boolean(confirmLabel);
        if (confirmMessage && !(await confirmDialog({ title: confirmMessage, message: confirmDetail, confirmLabel: confirmLabel ?? (destructive ? "Delete" : "Confirm"), destructive }))) return;
        start(async () => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields)) fd.set(k, v);
          let res: ActionButtonResult;
          try {
            res = await action(fd);
          } catch (err) {
            unstable_rethrow(err); // a redirect from the action (e.g. to sign-in) must still happen
            toast.error(typeof navigator !== "undefined" && !navigator.onLine ? "You appear to be offline. Try again when you're connected." : "That didn't go through. Please try again.");
            return;
          }
          if (res && res.ok === false) {
            toast.error(res.error ?? res.message ?? "That didn't go through. Please try again.");
            return;
          }
          if (navigateTo) router.push(navigateTo);
          router.refresh();
        });
      }}
    >
      {pending && props.size !== "icon-sm" && props.size !== "icon" ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
