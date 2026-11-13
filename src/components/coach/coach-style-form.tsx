"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { COACH_STYLE_LABELS, COACH_STYLES, type CoachStyle } from "@/lib/coach/style";
import { setCoachStyleAction } from "@/server/actions/coach-memory";

/** Choose how the coach talks to you. Tone and depth only: the facts, safety rules and approvals never change. */
export function CoachStyleForm({ current }: { current: CoachStyle | null }) {
  const [value, setValue] = useState<CoachStyle | "">(current ?? "");
  const [pending, start] = useTransition();
  return (
    <form
      data-testid="coach-style"
      className="space-y-3 rounded-2xl border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setCoachStyleAction(value || null);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="font-semibold">Coaching style</legend>
        <p className="text-sm text-muted-foreground">How the coach talks to you. Every style uses the same data and follows the same accuracy, privacy and safety rules.</p>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border p-3">
          <input type="radio" name="coach-style" value="" checked={value === ""} onChange={() => setValue("")} className="mt-1" />
          <span>
            <span className="block font-medium">Standard</span>
            <span className="block text-sm text-muted-foreground">Balanced: clear, friendly and practical.</span>
          </span>
        </label>
        {COACH_STYLES.map((s) => (
          <label key={s} className="flex min-h-11 items-start gap-3 rounded-xl border border-border p-3">
            <input type="radio" name="coach-style" value={s} checked={value === s} onChange={() => setValue(s)} className="mt-1" />
            <span>
              <span className="block font-medium">{COACH_STYLE_LABELS[s].label}</span>
              <span className="block text-sm text-muted-foreground">{COACH_STYLE_LABELS[s].description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save style
      </Button>
    </form>
  );
}
