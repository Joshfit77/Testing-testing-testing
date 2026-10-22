"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Activity, ArrowRight, Brain, Check, Dumbbell, Loader2, Pencil, Scale, Utensils, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CoachProposal } from "@/lib/coach/tools";
import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, MEMORY_MAX_CHARS, type MemoryCategory } from "@/lib/coach/memory";
import { Input, Textarea } from "@/components/ui/input";
import { displayWeight, weightUnit } from "@/lib/domain/units";
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

  const [editing, setEditing] = useState(false);
  const [memCategory, setMemCategory] = useState<MemoryCategory>(proposal.kind === "memory" ? proposal.category : "other");
  const [memText, setMemText] = useState(proposal.kind === "memory" ? proposal.content : "");
  const tc = proposal.kind === "training_change" ? proposal.change : null;
  const tcUnits = proposal.kind === "training_change" ? proposal.units : "metric";
  const [tWeight, setTWeight] = useState(tc?.kind === "exercise_target" ? String(displayWeight(tc.weightKg, tcUnits)) : "");
  const [tReps, setTReps] = useState(tc?.kind === "exercise_target" && tc.reps ? String(tc.reps) : "");
  const [tPercent, setTPercent] = useState(tc?.kind === "deload_week" ? String(Math.round(tc.setsFactor * 100)) : "60");
  const [tRpe, setTRpe] = useState(tc?.kind === "deload_week" ? String(tc.rpeCap) : "7");
  const [tDelta, setTDelta] = useState(tc?.kind === "volume_change" ? String(tc.deltaSets) : "1");
  const trainingEdit = () => {
    if (!tc || !editing) return undefined;
    if (tc.kind === "exercise_target") return { weight: Number(tWeight), reps: tReps ? Number(tReps) : null };
    if (tc.kind === "deload_week") return { setsPercent: Number(tPercent), rpeCap: Number(tRpe) };
    return { deltaSets: Number(tDelta) };
  };

  const canApply = proposal.kind !== "exercise_swap" || proposal.editable;
  const Icon = proposal.kind === "exercise_swap" ? Dumbbell : proposal.kind === "nutrition_targets" ? Utensils : proposal.kind === "bodyweight_log" ? Scale : proposal.kind === "training_change" ? Activity : Brain;
  const title = {
    exercise_swap: "Suggested exercise swap",
    nutrition_targets: "Suggested nutrition targets",
    bodyweight_log: "Log bodyweight",
    training_change: "Suggested training change",
    memory: "Remember this?",
    memory_forget: "Forget this memory?",
  }[proposal.kind];
  const isMemory = proposal.kind === "memory" || proposal.kind === "memory_forget";
  const confirmLabel = proposal.kind === "memory" ? "Save to memory" : proposal.kind === "memory_forget" ? "Forget" : proposal.kind === "training_change" ? (editing ? "Apply my version" : "Accept") : "Confirm";
  const declineLabel = proposal.kind === "memory" ? "Don't save" : proposal.kind === "memory_forget" ? "Keep it" : "Not now";
  const appliedLabel = proposal.kind === "memory" ? "saved" : proposal.kind === "memory_forget" ? "forgotten" : "applied";
  const declinedLabel = proposal.kind === "memory" ? "not saved" : proposal.kind === "memory_forget" ? "kept" : "dismissed";

  return (
    <div className="mt-3 rounded-2xl border border-gold-muted/60 bg-[#141210] p-4" data-testid="coach-suggestion">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold">
          <Icon className="size-4" aria-hidden /> {title}
        </p>
        {status && status !== "proposed" && <Badge variant={status === "applied" ? "success" : "secondary"}>{status === "applied" ? appliedLabel : declinedLabel}</Badge>}
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

      {proposal.kind === "memory" &&
        (editing && status === "proposed" ? (
          <div className="mt-2 space-y-2">
            <label className="block text-xs text-muted-foreground">
              Type
              <select
                value={memCategory}
                onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                className="mt-1 block h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              >
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MEMORY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Note
              <Textarea value={memText} onChange={(e) => setMemText(e.target.value)} maxLength={MEMORY_MAX_CHARS} rows={3} className="mt-1 text-sm" />
            </label>
          </div>
        ) : (
          <div className="mt-2 text-sm">
            <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{MEMORY_CATEGORY_LABELS[memCategory]}</p>
            <p className="mt-0.5">{memText}</p>
          </div>
        ))}

      {proposal.kind === "training_change" && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">{proposal.summary}</p>
          {editing && status === "proposed" && tc && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {tc.kind === "exercise_target" && (
                <>
                  <label className="text-xs text-muted-foreground">
                    Load ({weightUnit(tcUnits)})
                    <Input type="number" inputMode="decimal" step="0.5" value={tWeight} onChange={(e) => setTWeight(e.target.value)} className="mt-1" />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Reps
                    <Input type="number" inputMode="numeric" min="1" value={tReps} onChange={(e) => setTReps(e.target.value)} className="mt-1" />
                  </label>
                </>
              )}
              {tc.kind === "deload_week" && (
                <>
                  <label className="text-xs text-muted-foreground">
                    Keep % of sets
                    <Input type="number" min="40" max="80" step="5" value={tPercent} onChange={(e) => setTPercent(e.target.value)} className="mt-1" />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Effort cap (RPE)
                    <Input type="number" min="5" max="8" step="0.5" value={tRpe} onChange={(e) => setTRpe(e.target.value)} className="mt-1" />
                  </label>
                </>
              )}
              {tc.kind === "volume_change" && (
                <label className="text-xs text-muted-foreground">
                  Sets to add (−2 to 2)
                  <Input type="number" min="-2" max="2" value={tDelta} onChange={(e) => setTDelta(e.target.value)} className="mt-1" />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {proposal.kind === "memory_forget" && (
        <div className="mt-2 text-sm">
          <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{MEMORY_CATEGORY_LABELS[proposal.category]}</p>
          <p className="mt-0.5">{proposal.content}</p>
        </div>
      )}

      {"reason" in proposal && <p className="mt-2 text-xs text-muted-foreground">{proposal.reason}</p>}
      {isMemory && (
        <p className="mt-2 text-xs text-muted-foreground">
          {proposal.kind === "memory" ? "Nothing is saved unless you tap Save. " : ""}
          <Link href="/coach/memory" className="underline">
            Manage memory
          </Link>
        </p>
      )}

      {status === "proposed" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canApply ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  act(
                    () =>
                      applyCoachProposalAction(
                        messageId,
                        proposal.kind === "memory" && editing ? { category: memCategory, content: memText } : proposal.kind === "training_change" ? trainingEdit() : undefined,
                      ),
                    "applied",
                  )
                }
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {confirmLabel}
              </Button>
              {(proposal.kind === "memory" || proposal.kind === "training_change") && !editing && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => setEditing(true)}>
                  <Pencil aria-hidden /> {proposal.kind === "memory" ? "Edit" : "Modify"}
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => dismissProposalAction(messageId), "dismissed")}>
                <X aria-hidden /> {declineLabel}
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
