"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}
interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

let current: Pending | null = null;
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Styled replacement for window.confirm(). Resolves true when the user confirms. */
export function confirmDialog(req: ConfirmRequest | string): Promise<boolean> {
  const r = typeof req === "string" ? { title: req } : req;
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...r, resolve };
    open = true;
    emit();
  });
}

function settle(ok: boolean) {
  current?.resolve(ok);
  open = false;
  emit();
}

export function ConfirmHost() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (open ? current : null),
    () => null,
  );
  // Keep the last request rendered while the closing animation runs.
  const req = snap ?? current;
  return (
    <Dialog open={Boolean(snap)} onOpenChange={(o) => !o && settle(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{req?.title ?? "Are you sure?"}</DialogTitle>
          {req?.message ? <DialogDescription>{req.message}</DialogDescription> : <DialogDescription className="sr-only">Confirm this action</DialogDescription>}
        </DialogHeader>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button variant={req?.destructive ? "destructive" : "default"} onClick={() => settle(true)} autoFocus>
            {req?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
