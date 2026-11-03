"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, RefreshCw, ThumbsUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { LEVEL_LABELS, maskWords } from "@/lib/faith/memory";
import { redLetterWordFlags, type TextPart } from "@/lib/bible/red-letter";
import { ScriptureText } from "@/components/bible/scripture-text";
import { cn } from "@/lib/utils";
import { reviewMemoryAction } from "@/server/actions/bible";

/**
 * Practise one memory passage: words hidden for the current level (tap one to see it), or recall the reference from
 * the words. The member says how it went; the level and next review follow from that.
 */
export function MemoryPractice({ id, text, parts, reference, level }: { id: string; text: string; parts?: TextPart[]; reference: string; level: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"words" | "reference">("words");
  const [seed, setSeed] = useState(0);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [refShown, setRefShown] = useState(false);
  const [pending, start] = useTransition();
  const words = useMemo(() => maskWords(text, level, seed), [text, level, seed]);
  // Words of Jesus stay red when shown (same word split as maskWords).
  const red = useMemo(() => (parts ? redLetterWordFlags(parts) : []), [parts]);

  function finish(result: "remembered" | "struggled") {
    start(async () => {
      const r = await reviewMemoryAction(id, result);
      if (!r.ok) return toast.error(r.error);
      toast.success(r.status === "memorized" ? "Memorized. We'll bring it back now and then so it stays." : result === "remembered" ? `Next: ${(LEVEL_LABELS[r.level ?? 0] ?? "").toLowerCase()}.` : "We'll practise it again tomorrow.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Practice">
        {(["words", "reference"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setRefShown(false);
            }}
            className={cn("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold", mode === m ? "border-gold bg-gold/10 text-gold-highlight" : "border-border text-muted-foreground")}
          >
            {m === "words" ? "Hidden words" : "Recall the reference"}
          </button>
        ))}
      </div>

      {mode === "words" ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
            {reference} · {LEVEL_LABELS[level]}
          </p>
          <p className="font-serif text-xl leading-[1.9]" data-testid="memory-text">
            {words.map((w, i) =>
              w.hidden && !shown.has(i) ? (
                <button key={i} type="button" onClick={() => setShown((s) => new Set(s).add(i))} className="mx-0.5 rounded bg-elevated px-1 font-mono text-base text-muted-foreground" aria-label="Hidden word: tap to show">
                  {w.hint}
                </button>
              ) : (
                <span key={i}>
                  <span className={red[i] ? "text-red-letter" : undefined}>{w.word}</span>{" "}
                </span>
              ),
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {level > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShown(new Set(words.map((_, i) => i)))}>
                <Eye aria-hidden /> Show all
              </Button>
            )}
            {level > 0 && level < 4 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSeed((x) => x + 1);
                  setShown(new Set());
                }}
              >
                <RefreshCw aria-hidden /> Hide other words
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-serif text-xl leading-relaxed">
            <ScriptureText text={text} parts={parts} />
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Where is this from?</p>
          {refShown ? (
            <p className="mt-1 font-display text-xl font-bold text-gold-highlight">{reference}</p>
          ) : (
            <Button type="button" variant="secondary" size="sm" className="mt-1" onClick={() => setRefShown(true)}>
              <Eye aria-hidden /> Show the reference
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" disabled={pending} onClick={() => finish("remembered")}>
          <ThumbsUp aria-hidden /> I remembered it
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => finish("struggled")}>
          <Undo2 aria-hidden /> Needs more practice
        </Button>
      </div>
    </div>
  );
}
