"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Droplets, Dumbbell, Footprints, HandHeart, Moon, Plus, Scale, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/common/form-status";
import { DRAFT_EVENT, loadLocalDraft } from "@/lib/workout-storage";
import { useAddWater } from "@/components/nutrition/use-add-water";
import { cn } from "@/lib/utils";
import type { TodayWorkoutLink } from "@/app/(app)/home/today-workout/link";

/**
 * Quick Add: one "+" in every main header that opens the things members log most, each through the flow that
 * already exists (nothing here is a second way of saving anything):
 * a workout (resumes the one in progress; else today's program session when one is due; else an empty one), food
 * (the Add food dialog on Nutrition), a glass of water (logged right here), an outdoor run, a prayer (the journal),
 * a bodyweight entry and last night's sleep.
 *
 * `todayWorkout` comes from the page when it already knows (Home); elsewhere the sheet asks /home/today-workout the
 * first time it opens, and shows "Quick workout" (an empty session) until it knows or if it can't find out.
 */
export function QuickAddButton({ userId, today, todayWorkout, className }: { userId: string; today: string; todayWorkout?: TodayWorkoutLink; className?: string }) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [fetched, setFetched] = useState<TodayWorkoutLink | null>(null);
  const program = todayWorkout ?? fetched;
  const { state: water, add: addWater } = useAddWater(today);

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

  // Where today's program session starts: asked once, when the sheet first opens on a screen that didn't say.
  useEffect(() => {
    if (!open || todayWorkout || fetched) return;
    let live = true;
    fetch("/home/today-workout", { cache: "no-store", headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<TodayWorkoutLink>) : null))
      .then((link) => {
        if (live && link && typeof link.href === "string" && link.href.startsWith("/train/workout")) setFetched(link);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, todayWorkout, fetched]);

  const workout = draftName
    ? { href: "/train/workout", label: "Resume workout", detail: draftName }
    : program?.due
      ? { href: program.href, label: "Today's workout", detail: program.name }
      : { href: "/train/workout?blank=1", label: "Quick workout", detail: null };

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
            <Link href={workout.href} onClick={close} className={cn(tile, "col-span-3 min-h-14 flex-row gap-3 border-gold/60 bg-gold/10")} data-testid="quick-add-workout">
              <Dumbbell className="size-6 shrink-0 text-gold" aria-hidden />
              <span className="flex min-w-0 flex-col items-start text-left">
                <span>{workout.label}</span>
                {workout.detail && <span className="max-w-full truncate text-xs font-normal text-muted-foreground">{workout.detail}</span>}
              </span>
            </Link>
            <Link href="/nutrition?add=1" onClick={close} className={tile}>
              <Utensils className="size-6 text-gold" aria-hidden /> Food
            </Link>
            <form action={() => addWater(250)} className="contents">
              <SubmitButton variant="ghost" className={cn(tile, "h-auto whitespace-normal")} pendingLabel="Adding…" aria-label="Water: add 250 ml">
                <Droplets className="size-6 text-[#4A86C0]" aria-hidden /> Water +250 ml
              </SubmitButton>
            </form>
            <Link href="/run/record?kind=run" onClick={close} className={tile}>
              <Footprints className="size-6 text-gold" aria-hidden /> Outdoor run
            </Link>
            <Link href="/faith/journal/new?kind=daily" onClick={close} className={tile}>
              <HandHeart className="size-6 text-gold" aria-hidden /> Prayer
            </Link>
            <Link href="/progress/overview#log-weight" onClick={close} className={tile}>
              <Scale className="size-6 text-gold" aria-hidden /> Weight
            </Link>
            <Link href="/progress/sleep/log" onClick={close} className={tile}>
              <Moon className="size-6 text-gold" aria-hidden /> Sleep
            </Link>
          </div>
          {water.message && (
            <p role="status" className={cn("mt-3 text-sm", water.ok ? "text-gold-highlight" : "text-destructive-foreground")} data-testid="quick-add-water-result">
              {water.ok ? `${water.message} Added to today's water.` : water.message}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">The Nutrition tab has barcode scanning and meal photos.</p>
          <Button variant="secondary" className="mt-3 w-full" onClick={close}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
