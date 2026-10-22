"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Check, Dumbbell, Loader2, Scale, Utensils, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CoachProposal } from "@/lib/coach/tools";
import { applyCoachProposalAction, dismissProposalAction } from "@/server/actions/coach";

type Status = "proposed" | "applied" | "dismissed" | null;
type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * A change the coach suggested. Nothing is applied until the user taps Confirm, which calls a server
 * action that re-validates everything against their current data.
 */
export function SuggestionCard({ messageId, proposal, status, onChange }: { messageId: string; proposal: CoachProposal; status: Status; onChange: (s: Status) => void }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const act = (fn: () => Promise<ActionResult>, next: Status) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setResult({ ok: true, text: r.message });
        onChange(next);
      } else setResult({ ok: false, text: r.error });
    });

  const canApply = proposal.kind !== "exercise_swap" || proposal.editable;
  const Icon = proposal.kind === "exercise_swap" ? Dumbbell : proposal.kind === "nutrition_targets" ? Utensils : Scale;
  const title = proposal.kind === "exercise_swap" ? "Suggested exercise swap" : proposal.kind === "nutrition_targets" ? "Suggested nutrition targets" : "Log bodyweight";

  return (
    <div className="mt-3 rounded-2xl border border-gold-muted/60 bg-[#141210] p-4" data-testid="coach-suggestion">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
          <Icon className="size-4" aria-hidden /> {title}
        </p>
        {status && status !== "proposed" && <Badge variant={status === "applied" ? "success" : "secondary"}>{status === "applied" ? "applied" : "dismissed"}</Badge>}
      </div>

      {proposal.kind === "exercise_swap" && (
        <div className="mt-2 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span>{proposal.from.name}</span>
            <ArrowRight className="size-4 text-gold" aria-label="replaced by" />
            <span>{proposal.to.name}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {proposal.scope === "next_workout" ? "Next session only" : "Rest of the program"} · {proposal.programName}
          </p>
          {!proposal.editable && (
            <p className="mt-2 text-xs text-muted-foreground">
              This is a library program, so it can&apos;t be edited here. When you reach {proposal.from.name} in the workout logger, tap <strong>Swap</strong> and pick {proposal.to.name}.{" "}
              <Link href={`/train/exercises/${proposal.to.slug}`} className="underline">
                See {proposal.to.name}
              </Link>
            </p>
          )}
        </div>
      )}

      {proposal.kind === "nutrition_targets" && (
        <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-sm">
          {(
            [
              ["Calories", proposal.calories, proposal.previous?.calories, "kcal"],
              ["Protein", proposal.protein_g, proposal.previous?.protein_g, "g"],
              ["Carbs", proposal.carbs_g, proposal.previous?.carbs_g, "g"],
              ["Fat", proposal.fat_g, proposal.previous?.fat_g, "g"],
            ] as const
          ).map(([label, value, prev, unit]) => (
            <div key={label} className="rounded-xl bg-elevated/60 p-2">
              <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="font-semibold">
                {value}
                <span className="text-xs font-normal text-muted-foreground"> {unit}</span>
              </dd>
              {prev != null && prev !== value && <dd className="text-[0.6875rem] text-muted-foreground">was {prev}</dd>}
            </div>
          ))}
        </dl>
      )}

      {proposal.kind === "bodyweight_log" && (
        <p className="mt-2 text-sm">
          <strong>{proposal.display}</strong> on {proposal.date}
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">{proposal.reason}</p>

      {status === "proposed" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canApply ? (
            <>
              <Button size="sm" disabled={pending} onClick={() => act(() => applyCoachProposalAction(messageId), "applied")}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Confirm
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => dismissProposalAction(messageId), "dismissed")}>
                <X aria-hidden /> Not now
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => dismissProposalAction(messageId), "dismissed")}>
              <Check aria-hidden /> Got it
            </Button>
          )}
        </div>
      )}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("mt-2 text-sm", result.ok ? "text-[#5fc49a]" : "text-[#f08a8a]")}>
          {result.text}
        </p>
      )}
    </div>
  );
}
