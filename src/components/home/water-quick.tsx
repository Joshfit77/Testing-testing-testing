"use client";

import { Droplets } from "lucide-react";
import { SubmitButton } from "@/components/common/form-status";
import { useAddWater } from "@/components/nutrition/use-add-water";

/** Home's water line: today's total against the goal and one +250 ml tap (the same action as the Nutrition tab). */
export function WaterQuick({ date, totalMl, goalMl }: { date: string; totalMl: number; goalMl: number }) {
  const { state, add } = useAddWater(date);
  const pct = goalMl ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  return (
    <div className="flex items-center gap-3" data-testid="home-water">
      <Droplets className="size-5 shrink-0 text-[#4A86C0]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">Water</span>{" "}
          <span className="tabular-nums text-muted-foreground">
            {(totalMl / 1000).toFixed(2)} / {(goalMl / 1000).toFixed(1)} L
          </span>
        </p>
        <div role="progressbar" aria-label="Water today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
          <div className="h-full rounded-full bg-[#4A86C0] transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {state.message && !state.ok && (
          <p className="mt-1 text-xs text-destructive-foreground" role="alert">
            {state.message}
          </p>
        )}
      </div>
      <form action={() => add(250)}>
        <SubmitButton size="sm" variant="secondary" pendingLabel="…" className="min-h-11">
          +250 ml
        </SubmitButton>
      </form>
    </div>
  );
}
