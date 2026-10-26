"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { AI_PLAN_DAYS, FOCUS_LABELS, MEAL_PLAN_FOCUSES, type MealPlanFocus } from "@/lib/domain/ai-meal-plan";
import type { DayFit, PlanNutrition } from "@/lib/domain/meal-planner";
import { approveAiMealPlanAction, discardAiMealPlanAction, draftAiMealPlanAction } from "@/server/actions/ai-meal-plan";

export interface AiDraftView {
  focus: MealPlanFocus;
  notes: string | null;
  summary: string | null;
  targets: PlanNutrition & { explanation: string[] };
  days: {
    date: string;
    title: string;
    fit: DayFit;
    meals: { label: string; meal: { name: string; portion: number; nutrition: PlanNutrition; complete: boolean; by: "ai" | "planner" } | null }[];
  }[];
}

function Message({ state }: { state: ActionState | null }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-[#5fc49a]" : "text-sm text-[#f08a8a]"}>
      {state.message}
    </p>
  );
}

export function AiMealPlanPanel({ entitled, defaultStart, draft }: { entitled: boolean; defaultStart: string; draft: AiDraftView | null }) {
  const router = useRouter();
  const [start, setStart] = useState(defaultStart);
  const [days, setDays] = useState("3");
  const [focus, setFocus] = useState<MealPlanFocus>("balanced");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      const r = await fn();
      setState(r);
      if (r.ok) router.refresh();
    });

  if (!entitled) {
    return (
      <section aria-labelledby="ai-plan-title" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="ai-plan-title" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5 text-gold" aria-hidden /> AI meal plans
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pro adds AI-arranged plans for 1, 3 or 7 days around a focus (high protein, weight loss, muscle gain, maintenance) and your notes, built only from dishes with database nutrition.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/profile/billing">See Pro</Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="ai-plan-title" className="space-y-3 rounded-2xl border border-gold-muted/60 bg-card-gradient p-4">
      <h2 id="ai-plan-title" className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="size-5 text-gold" aria-hidden /> AI meal plan
      </h2>
      <p className="text-sm text-muted-foreground">
        The AI arranges dishes from your recipes, saved meals and the app&apos;s recipes; the app works out every number from the food database. You review the draft before anything is saved. Uses one of your monthly AI messages.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => draftAiMealPlanAction({ startDate: start, days: Number(days), focus, notes: notes.trim() || undefined }));
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ai-start">Start</Label>
          <Input id="ai-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-days">Days</Label>
          <NativeSelect id="ai-days" value={days} onChange={(e) => setDays(e.target.value)}>
            {AI_PLAN_DAYS.map((d) => (
              <option key={d} value={d}>
                {d} day{d === 1 ? "" : "s"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ai-focus">Focus</Label>
          <NativeSelect id="ai-focus" value={focus} onChange={(e) => setFocus(e.target.value as MealPlanFocus)}>
            {MEAL_PLAN_FOCUSES.map((f) => (
              <option key={f} value={f}>
                {FOCUS_LABELS[f]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ai-notes">Notes (optional)</Label>
          <Textarea id="ai-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} placeholder="e.g. quick breakfasts on weekdays, bigger dinner after training" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} {draft ? "Draft a new plan" : "Draft my plan"}
          </Button>
        </div>
      </form>
      <Message state={state} />
      <p className="text-xs text-muted-foreground">
        Allergies and dislikes from your planner settings are filtered by ingredient names. That is not a guarantee a dish is free of an allergen: always check labels and recipes.
        AI-arranged plans are general wellness nutrition, not a medical diet, and can contain mistakes. Notes about a health condition aren&apos;t used: for a
        medical diet, pregnancy or a history of disordered eating, talk to your doctor or a registered dietitian.
      </p>

      {draft && (
        <div className="space-y-3 border-t border-border pt-3" data-testid="ai-plan-draft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              Draft: {FOCUS_LABELS[draft.focus]}
              {draft.notes ? <span className="font-normal text-muted-foreground"> · “{draft.notes}”</span> : null}
            </h3>
            <Badge variant="secondary">Not saved yet</Badge>
          </div>
          <div className="rounded-xl bg-elevated/60 p-3 text-sm">
            <p className="tabular-nums">
              Targets: {draft.targets.calories.toLocaleString()} kcal · protein {draft.targets.protein_g} g · carbs {draft.targets.carbs_g} g · fat {draft.targets.fat_g} g
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {draft.targets.explanation.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          {draft.summary && <p className="whitespace-pre-line text-sm">{draft.summary}</p>}
          {draft.days.map((d) => (
            <div key={d.date} className="rounded-xl border border-border p-3" data-testid="ai-plan-day">
              <p className="font-semibold">{d.title}</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {d.fit.totals.calories.toLocaleString()} of {draft.targets.calories.toLocaleString()} kcal ·{" "}
                {d.fit.status === "close" ? "close to target" : d.fit.status === "under" ? `${d.fit.percentOff}% under` : `${d.fit.percentOff}% over`} · protein {d.fit.totals.protein_g} g
              </p>
              <ul className="mt-1 divide-y divide-border text-sm">
                {d.meals.map((m, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                    <span>
                      <span className="text-gold">{m.label}:</span> {m.meal ? `${m.meal.name} × ${m.meal.portion}` : "nothing fits"}
                      {m.meal?.by === "planner" && <span className="text-xs text-muted-foreground"> (filled by the planner)</span>}
                    </span>
                    {m.meal && (
                      <span className="tabular-nums text-muted-foreground">
                        {m.meal.nutrition.calories} kcal{m.meal.complete ? "" : " (at least)"} · P {m.meal.nutrition.protein_g}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Numbers are estimates from database and label values for the dishes as written; “at least” means an ingredient lacks a value. Not medical or dietetic advice.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => run(() => approveAiMealPlanAction())}>
              <Check aria-hidden /> Approve &amp; save plan
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => run(() => discardAiMealPlanAction())}>
              <X aria-hidden /> Discard
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
