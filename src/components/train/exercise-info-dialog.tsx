"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ListOrdered, Maximize2, Minimize2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { shownDemoAsset as getDemoAsset } from "@/lib/exercise-demos";
import { demoCaption, demoReadiness } from "@/lib/exercise-demo-readiness";
import { ExerciseDemo, type DemoMuscles } from "./exercise-demo";

export interface ExerciseInfoText {
  /** How to set up (the library's written steps). */
  steps: readonly string[];
  /** Form cues while moving. */
  cues: readonly string[];
  mistakes: readonly string[];
}

type Tab = "setup" | "execution" | "mistakes";

/**
 * The exercise demonstration, full width: the moving 2D athlete (or a 2.5D clip, pose frames or the labelled
 * placeholder, whichever is ready), the name over it, then Setup / Execution / Mistakes from the exercise library.
 * Opened from the workout's current-set card (the thumbnail or "Exercise info").
 */
export function ExerciseInfoDialog({
  open,
  onOpenChange,
  slug,
  name,
  muscles,
  text,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  name: string;
  muscles?: DemoMuscles;
  text: ExerciseInfoText | null;
}) {
  const [tab, setTab] = useState<Tab>("setup");
  const [full, setFull] = useState(false);
  const asset = getDemoAsset(slug);
  const readiness = demoReadiness(slug);
  const lists: Record<Tab, readonly string[]> = {
    setup: text?.steps ?? [],
    execution: text?.cues ?? [],
    mistakes: text?.mistakes ?? [],
  };
  const empty: Record<Tab, string> = {
    setup: "No written set-up steps for this exercise yet.",
    execution: "No form cues for this exercise yet.",
    mistakes: "No common mistakes listed for this exercise yet.",
  };
  const Icon = tab === "mistakes" ? AlertTriangle : tab === "setup" ? ListOrdered : CheckCircle2;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setFull(false);
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={cn("gap-0 overflow-hidden p-0", full ? "inset-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none" : "max-w-2xl")}
        data-testid="exercise-info"
      >
        <div className={cn("flex flex-col bg-[#0a0a0a]", full ? "flex-1 min-h-0" : "")}>
          {open ? (
            <ExerciseDemo slug={slug} name={name} muscles={muscles} className={cn("w-full", full ? "min-h-0 flex-1" : asset ? "max-h-[50vh]" : "aspect-[4/3]")} />
          ) : null}
          <div className="flex items-end justify-between gap-3 bg-gradient-to-b from-[#0a0a0a] to-card px-4 pb-3 pt-3">
            <div className="min-w-0">
              <DialogTitle className="line-clamp-2 text-2xl font-bold leading-tight text-white [text-wrap:balance]">{name}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">{demoCaption(readiness, Boolean(asset))}</DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setFull((f) => !f)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-elevated text-foreground hover:border-gold-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label={full ? "Exit full screen" : "Full screen"}
              aria-pressed={full}
            >
              {full ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
        {!full && (
          <div className="space-y-4 px-4 pb-4">
            <Segmented
              tabs
              label="Exercise information"
              items={[
                { key: "setup", label: "Setup", active: tab === "setup", testId: "info-tab-setup" },
                { key: "execution", label: "Execution", active: tab === "execution", testId: "info-tab-execution" },
                { key: "mistakes", label: "Mistakes", active: tab === "mistakes", testId: "info-tab-mistakes" },
              ]}
              onSelect={(k) => setTab(k as Tab)}
            />
            <ul className="space-y-2.5 text-[0.9375rem] leading-snug" data-testid={`info-${tab}`} role="tabpanel">
              {lists[tab].length === 0 ? (
                <li className="text-sm text-muted-foreground">{empty[tab]}</li>
              ) : (
                lists[tab].map((line, i) => (
                  <li key={line} className="flex gap-3">
                    {tab === "setup" ? (
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-highlight tabular-nums" aria-hidden>
                        {i + 1}
                      </span>
                    ) : (
                      <Icon className={cn("mt-0.5 size-5 shrink-0", tab === "mistakes" ? "text-[#e0a05a]" : "text-gold")} aria-hidden />
                    )}
                    <span>{line}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
