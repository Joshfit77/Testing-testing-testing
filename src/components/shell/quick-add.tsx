"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Droplets, Dumbbell, Footprints, HandHeart, Plus, Scale, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/common/form-status";
import { initialActionState } from "@/lib/action-state";
import { DRAFT_EVENT, loadLocalDraft } from "@/lib/workout-storage";
import { addWaterAction } from "@/server/actions/nutrition";
import { cn } from "@/lib/utils";

/**
 * Quick Add: one "+" in every main header that opens the things members log most, each through the flow that
 * already exists (nothing here is a second way of saving anything):
 * food (the Add food dialog on Nutrition), a glass of water (logged right here), a workout (resumes the one in
 * progress, else starts an empty one), an outdoor run, a prayer (the journal) and a bodyweight entry.
 */
export function QuickAddButton({ userId, today, className }: { userId: string; today: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [water, addWater] = useActionState(addWaterAction, initialActionState);

  useEffect(() => {
    const refresh = () => setDraftName(loadLocalDraft(userId)?.name ?? null);
    refresh();
    window.addEventListener(DRAFT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DRAFT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  const tile = "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-elevated/60 px-2 py-3 text-center text-sm font-semibold leading-tight hover:border-gold-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight";
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick add"
        aria-haspopup="dialog"
        data-testid="quick-add"
        className={cn("group inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none", className)}
      >
        <span className="flex size-[2.125rem] items-center justify-center rounded-full bg-gold-gradient text-black shadow-bronze transition-transform group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-gold-highlight">
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="bottom">
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
            <DialogDescription>Log something now, from anywhere in the app.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2" data-testid="quick-add-sheet">
            <Link href="/nutrition?add=1" onClick={close} className={tile}>
              <Utensils className="size-6 text-gold" aria-hidden /> Food
            </Link>
            <form action={addWater} className="contents">
              <input type="hidden" name="date" value={today} />
              <input type="hidden" name="amountMl" value="250" />
              <SubmitButton variant="ghost" className={cn(tile, "h-auto whitespace-normal")} pendingLabel="Adding…" aria-label="Water: add 250 ml">
                <Droplets className="size-6 text-[#4A86C0]" aria-hidden /> Water +250 ml
              </SubmitButton>
            </form>
            <Link href={draftName ? "/train/workout" : "/train/workout?blank=1"} onClick={close} className={tile}>
              <Dumbbell className="size-6 text-gold" aria-hidden /> {draftName ? "Resume workout" : "Quick workout"}
            </Link>
            <Link href="/run/record?kind=run" onClick={close} className={tile}>
              <Footprints className="size-6 text-gold" aria-hidden /> Outdoor run
            </Link>
            <Link href="/faith/journal/new?kind=daily" onClick={close} className={tile}>
              <HandHeart className="size-6 text-gold" aria-hidden /> Prayer
            </Link>
            <Link href="/progress/overview#log-weight" onClick={close} className={tile}>
              <Scale className="size-6 text-gold" aria-hidden /> Weight
            </Link>
          </div>
          {water.message && (
            <p role="status" className={cn("mt-3 text-sm", water.ok ? "text-gold-highlight" : "text-destructive-foreground")} data-testid="quick-add-water-result">
              {water.ok ? `${water.message} Added to today's water.` : water.message}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Today&apos;s program workout is on Home and Train. The Nutrition tab has barcode scanning and meal photos.</p>
          <Button variant="secondary" className="mt-3 w-full" onClick={close}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
