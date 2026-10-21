"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { setDayMarkAction } from "@/server/actions/nutrition-days";

/**
 * Mark the day complete, or record that you ate nothing (a fast). Weekly insights then count the day
 * properly instead of treating it as "not logged".
 */
export function DayMarkControls({ date, mark, hasFood }: { date: string; mark: "complete" | "fasted" | null; hasFood: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const set = (status: "complete" | "fasted" | null) =>
    start(async () => {
      const res = await setDayMarkAction({ date, status });
      setState(res);
      if (res.ok) router.refresh();
    });
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3" data-testid="day-mark">
      {mark ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[0.9375rem]">
            <CheckCircle2 className="size-4 text-[#5fc49a]" aria-hidden />
            {mark === "fasted" ? "Logged as a day you ate nothing (counts as 0 in insights)." : "Day marked complete."}
          </p>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => set(null)}>
            Undo
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="w-full text-sm text-muted-foreground">Done for the day? Marking it helps your weekly insights tell a full day from a missed one.</p>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => set("complete")}>
            Mark day complete
          </Button>
          {!hasFood && (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => set("fasted")}>
              I ate nothing this day
            </Button>
          )}
        </div>
      )}
      {state?.message && !state.ok && (
        <p role="alert" className="mt-1 text-sm text-[#f08a8a]">
          {state.message}
        </p>
      )}
    </div>
  );
}
