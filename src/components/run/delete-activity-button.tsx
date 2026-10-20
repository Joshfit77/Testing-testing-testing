"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toaster";
import { deleteActivityAction } from "@/server/actions/activities";

export function DeleteActivityButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      aria-busy={pending}
      onClick={async () => {
        const ok = await confirmDialog({
          title: `Delete this ${label}?`,
          message: "It will be removed from your history, weekly mileage and records.",
          confirmLabel: "Delete",
          destructive: true,
        });
        if (!ok) return;
        start(async () => {
          const res = await deleteActivityAction(id);
          if (!res.ok) {
            toast.error(res.message ?? "Couldn't delete this activity.");
            return;
          }
          toast.success(res.message ?? "Activity deleted.");
          router.push("/run?tab=history");
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
      Delete
    </Button>
  );
}
