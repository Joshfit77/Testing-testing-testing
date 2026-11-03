"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ListOrdered, Play, Presentation, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  currentStep,
  DEMO_INTRO_SHOWN_KEY,
  PRESENTER_STEP_KEY,
  PRESENTER_STEPS,
  PRESENTER_VIEW_KEY,
  STEP_COUNT,
  STEP_LABEL_TEXT,
  stepByNumber,
  type PresenterStep,
  type StepLabel,
} from "@/lib/demo/presenter";

type View = "bar" | "list" | "hidden";

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode: the panel still works, it just forgets */
  }
}

const LABEL_STYLE: Record<StepLabel, string> = {
  live: "border-gold/70 text-gold",
  sample: "border-border text-muted-foreground",
  simulated: "border-amber-500/60 text-amber-300",
  preview: "border-sky-500/50 text-sky-300",
};

export function StepTag({ label }: { label: StepLabel }) {
  return (
    <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wider", LABEL_STYLE[label])} data-testid={`presenter-tag-${label}`}>
      {STEP_LABEL_TEXT[label]}
    </span>
  );
}

/**
 * Demo deployments only: the presenter's guided path (src/lib/demo/presenter.ts). Shows the current stop, Back / Next,
 * a list to jump to any stop (skip ahead, come back), a way back to the path after a detour, and Play the opening.
 * Remembered in this browser tab only.
 */
export function PresenterPanel() {
  const path = usePathname() ?? "/";
  const [view, setView] = useState<View>("bar");
  const [remembered, setRemembered] = useState<number | null>(null);
  // Until this tab's remembered stop has been read, don't follow the page (it would overwrite the stop with a guess).
  const [loaded, setLoaded] = useState(false);
  // The page a Next / Back / list tap was made on: until the route changes, the old page isn't a reason to follow.
  const leaving = useRef<string | null>(null);

  useEffect(() => {
    const v = read(PRESENTER_VIEW_KEY);
    if (v === "list" || v === "hidden") setView(v);
    const n = Number(read(PRESENTER_STEP_KEY));
    if (n >= 1 && n <= STEP_COUNT) setRemembered(n);
    setLoaded(true);
  }, []);

  const { step, offPath } = currentStep(path, remembered);
  // Follow the presenter when they use the app's own navigation to reach a stop.
  useEffect(() => {
    if (leaving.current !== null) {
      if (leaving.current === path) return;
      leaving.current = null;
    }
    if (loaded && step && !offPath && step.n !== remembered) {
      setRemembered(step.n);
      write(PRESENTER_STEP_KEY, String(step.n));
    }
  }, [loaded, path, step, offPath, remembered]);

  const show = (v: View) => {
    setView(v);
    write(PRESENTER_VIEW_KEY, v);
  };
  const go = (s: PresenterStep) => {
    leaving.current = path;
    setRemembered(s.n);
    write(PRESENTER_STEP_KEY, String(s.n));
  };
  const playOpening = () => {
    write(DEMO_INTRO_SHOWN_KEY, null);
    write(PRESENTER_STEP_KEY, "1");
    // A full load, so the opening plays as it does when the app is launched.
    window.location.assign("/home");
  };

  if (view === "hidden") {
    return (
      <button type="button" onClick={() => show("bar")} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground hover:border-gold-muted" data-testid="presenter-show">
        <Presentation className="size-3.5 text-gold" aria-hidden /> Presenter
      </button>
    );
  }

  const n = step?.n ?? 0;
  const prev = n > 1 ? stepByNumber(n - 1) : undefined;
  const next = n < STEP_COUNT ? stepByNumber(n + 1) : undefined;

  return (
    <nav aria-label="Presenter" className="w-full basis-full border-t border-gold-muted/40 pt-2" data-testid="presenter-panel">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Presentation className="size-3.5 shrink-0 text-gold" aria-hidden />
          {step ? (
            <span className="flex min-w-0 items-center gap-1.5" data-testid="presenter-current">
              <span className="truncate font-semibold text-foreground">
                {n}/{STEP_COUNT} {step.title}
              </span>
              <StepTag label={step.label} />
            </span>
          ) : (
            <span className="text-foreground">Guided path: 20 stops</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {prev ? (
            <Link href={prev.href} onClick={() => go(prev)} className="rounded-full border border-border p-1 text-foreground hover:border-gold-muted" aria-label={`Back to ${prev.title}`} data-testid="presenter-prev">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : null}
          {step ? (
            next ? (
              <Link
                href={next.href}
                onClick={() => go(next)}
                className="flex items-center gap-0.5 rounded-full border border-gold bg-gold px-2.5 py-1 font-semibold text-black"
                data-testid="presenter-next"
              >
                Next <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            ) : null
          ) : (
            <button type="button" onClick={playOpening} className="rounded-full border border-gold bg-gold px-2.5 py-1 font-semibold text-black" data-testid="presenter-start">
              Start
            </button>
          )}
          <button
            type="button"
            onClick={() => show(view === "list" ? "bar" : "list")}
            aria-expanded={view === "list"}
            className="rounded-full border border-border p-1 text-foreground hover:border-gold-muted"
            aria-label="All stops"
            data-testid="presenter-list-toggle"
          >
            <ListOrdered className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => show("hidden")} className="rounded-full border border-border p-1 text-foreground hover:border-gold-muted" aria-label="Hide the presenter panel" data-testid="presenter-hide">
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      {offPath && step && (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span>Off the guided path.</span>
          <Link href={step.href} className="flex items-center gap-1 font-semibold text-gold underline-offset-2 hover:underline" data-testid="presenter-return">
            <Undo2 className="size-3.5" aria-hidden /> Back to {n}. {step.title}
          </Link>
        </p>
      )}
      {step && !offPath && <p className="mt-1 text-muted-foreground" data-testid="presenter-show-line">{step.show}</p>}
      {step?.n === 1 && !offPath && (
        <button type="button" onClick={playOpening} className="mt-2 flex items-center gap-1 rounded-full border border-gold-muted px-2.5 py-1 font-semibold text-foreground hover:border-gold" data-testid="presenter-play-opening">
          <Play className="size-3.5 text-gold" aria-hidden /> Play the opening
        </button>
      )}

      {view === "list" && (
        <ol className="mt-2 grid gap-1 sm:grid-cols-2" data-testid="presenter-list">
          {PRESENTER_STEPS.map((s) => {
            const itemClass = cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left",
              s.n === n ? "border-gold bg-gold/10 text-foreground" : "border-border/70 hover:border-gold-muted",
            );
            const inner = (
              <>
                <span className="min-w-0 truncate">
                  <span className="tabular-nums text-muted-foreground">{s.n}.</span> <span className="font-medium text-foreground">{s.title}</span>
                </span>
                <StepTag label={s.label} />
              </>
            );
            return (
              <li key={s.n}>
                {/* The opening needs a full page load to play, so stop 1 is a button rather than a link. */}
                {s.n === 1 ? (
                  <button type="button" onClick={playOpening} aria-current={s.n === n ? "step" : undefined} className={itemClass}>
                    {inner}
                  </button>
                ) : (
                  <Link
                    href={s.href}
                    onClick={() => {
                      go(s);
                      // Close the list after a jump, so it doesn't cover the screen being shown.
                      show("bar");
                    }}
                    aria-current={s.n === n ? "step" : undefined} className={itemClass}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
