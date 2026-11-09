"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { disconnectSleepSourceAction } from "@/server/actions/sleep-import";

/**
 * One "Disconnect…" button. The confirm step asks what happens to the nights already imported: keep them, or remove
 * them. Either way imports stop and the connection is forgotten; entries the member made stay, and the phone's own
 * health records are never touched.
 */
export function DisconnectSleepSource({ sourceLabel, importedCount }: { sourceLabel: string; importedCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<"keep" | "remove" | null>(null);
  const run = (remove: boolean) => {
    setChoice(remove ? "remove" : "keep");
    start(async () => {
      const fd = new FormData();
      if (remove) fd.set("remove", "on");
      await disconnectSleepSourceAction(fd);
      setOpen(false);
      router.refresh();
    });
  };
  const nights = `${importedCount} imported ${importedCount === 1 ? "entry" : "entries"}`;
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={pending}>
        Disconnect…
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect {sourceLabel}?</DialogTitle>
            <DialogDescription>
              Imports stop and the connection is forgotten. Choose what happens to the {nights} already here. Entries you made yourself stay, and your phone&apos;s own health records are not touched.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" onClick={() => run(false)} disabled={pending} aria-busy={pending && choice === "keep"}>
              {pending && choice === "keep" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Disconnect, keep imported nights
            </Button>
            <Button type="button" variant="destructive" onClick={() => run(true)} disabled={pending} aria-busy={pending && choice === "remove"}>
              {pending && choice === "remove" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Disconnect and remove imported nights
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
