"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";

/**
 * A button that invokes a server action with fixed fields, then refreshes the current route.
 * Used for simple one-click mutations (toggle, delete, mark done) rendered by server components.
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
  action: (formData: FormData) => Promise<void>;
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
          await action(fd);
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
