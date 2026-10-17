"use client";

import { useState, useTransition } from "react";
import { Check, Circle, Loader2, Minus, Pill, Plus, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import {
  EVIDENCE_LABELS,
  getSupplement,
  SUPPLEMENT_CATEGORIES,
  SUPPLEMENT_CATEGORY_LABELS,
  SUPPLEMENTS,
  supplementFitsDiet,
  type EvidenceLevel,
  type Supplement,
  type SupplementCategory,
} from "@/data/supplements";
import type { ActionState } from "@/lib/action-state";
import type { DietType } from "@/lib/domain/diets";
import { cn } from "@/lib/utils";
import { addToStackAction, removeFromStackAction, toggleTakenAction } from "@/server/actions/supplements";

const EVIDENCE_VARIANT: Record<EvidenceLevel, "default" | "secondary" | "outline"> = {
  strong: "default",
  moderate: "secondary",
  limited: "outline",
};

interface Props {
  today: string;
  stack: string[];
  takenToday: string[];
  dietId: DietType | null;
  dietName: string | null;
}

/** Runs one server action at a time per key and reports the result honestly. */
function usePendingAction() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, start] = useTransition();
  const run = (key: string, fn: () => Promise<ActionState>) => {
    setPendingKey(key);
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          if (res.message) toast.success(res.message);
        } else toast.error(res.message ?? "Something went wrong. Please try again.");
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setPendingKey(null);
      }
    });
  };
  return { pendingKey, run };
}

function dietNote(s: Supplement, dietId: DietType | null, dietName: string | null): string | null {
  if (!dietId || !dietName || supplementFitsDiet(s, dietId)) return null;
  return s.alternative ? `Not suitable for your ${dietName} diet — try ${s.alternative}.` : `Not suitable for your ${dietName} diet.`;
}

export function SupplementsClient({ today, stack, takenToday, dietId, dietName }: Props) {
  const [category, setCategory] = useState<SupplementCategory | "all">("all");
  const { pendingKey, run } = usePendingAction();
  const inStack = new Set(stack);
  const taken = new Set(takenToday);
  const stackItems = stack.map((id) => getSupplement(id)).filter((s): s is Supplement => Boolean(s));
  const takenCount = stackItems.filter((s) => taken.has(s.id)).length;
  const shown = category === "all" ? SUPPLEMENTS : SUPPLEMENTS.filter((s) => s.category === category);

  return (
    <div className="space-y-6">
      <section className="bg-card-gradient rounded-2xl border border-gold-muted/60 p-5" aria-labelledby="stack-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="stack-title" className="font-display text-xl font-bold uppercase">
            My stack today
          </h2>
          {stackItems.length > 0 && (
            <p className="text-sm tabular-nums text-muted-foreground" data-testid="stack-count">
              {takenCount} of {stackItems.length} taken
            </p>
          )}
        </div>
        {stackItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your stack is empty. Add supplements below to check them off each day.</p>
        ) : (
          <ul className="space-y-2">
            {stackItems.map((s) => {
              const done = taken.has(s.id);
              const busy = pendingKey === `toggle:${s.id}`;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={done}
                    aria-label={done ? `${s.name}: taken today. Mark as not taken` : `${s.name}: not yet. Mark as taken today`}
                    disabled={busy}
                    onClick={() => run(`toggle:${s.id}`, () => toggleTakenAction({ supplementId: s.id, date: today }))}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      done ? "border-gold-muted/70 bg-gold/10" : "border-border bg-elevated/60 hover:border-gold-muted",
                    )}
                  >
                    <span
                      className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border", done ? "border-gold bg-gold text-primary-foreground" : "border-border text-muted-foreground")}
                      aria-hidden
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : done ? <Check className="size-4" /> : <Circle className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.dose} · {done ? "Taken today" : "Not yet"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {(["all", ...SUPPLEMENT_CATEGORIES] as const).map((c) => (
          <Button key={c} type="button" size="sm" variant={category === c ? "default" : "secondary"} aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c === "all" ? "All" : SUPPLEMENT_CATEGORY_LABELS[c]}
          </Button>
        ))}
      </div>

      <ul className="grid gap-4 md:grid-cols-2" aria-label="Supplements">
        {shown.map((s) => {
          const added = inStack.has(s.id);
          const note = dietNote(s, dietId, dietName);
          const busy = pendingKey === `stack:${s.id}`;
          return (
            <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby={`sup-${s.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id={`sup-${s.id}`} className="flex items-center gap-2 font-display text-lg font-semibold uppercase leading-tight">
                    <Pill className="size-4 shrink-0 text-gold" aria-hidden /> {s.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.purpose}</p>
                </div>
                <Badge variant={EVIDENCE_VARIANT[s.evidence]} className="shrink-0">
                  {EVIDENCE_LABELS[s.evidence]}
                </Badge>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Dose</dt>
                <dd>{s.dose}</dd>
                <dt className="text-muted-foreground">Timing</dt>
                <dd>{s.timing}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">Cautions: </span>
                {s.cautions}
              </p>
              {note && (
                <p className="flex items-start gap-1.5 text-xs text-gold">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {note}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                <Badge variant="outline">{SUPPLEMENT_CATEGORY_LABELS[s.category]}</Badge>
                {added ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-busy={busy}
                    aria-label={`Remove ${s.name} from stack`}
                    onClick={() => run(`stack:${s.id}`, () => removeFromStackAction({ supplementId: s.id }))}
                  >
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Minus aria-hidden />} Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-busy={busy}
                    aria-label={`Add ${s.name} to stack`}
                    onClick={() => run(`stack:${s.id}`, () => addToStackAction({ supplementId: s.id }))}
                  >
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Add to stack
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
