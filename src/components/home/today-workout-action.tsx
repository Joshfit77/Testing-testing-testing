"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DRAFT_EVENT, loadLocalDraft } from "@/lib/workout-storage";

/**
 * Start or Resume for Home's "Today's workout" card. Resume when the server has an in-progress session
 * or this device holds an unfinished workout draft (the logger restores it at /train/workout).
 */
export function TodayWorkoutAction({
  userId,
  startHref,
  serverInProgress,
  startLabel = "Start workout",
  round = false,
}: {
  userId: string;
  startHref: string;
  serverInProgress: string | null;
  /** e.g. "Start workout early" when the next session is planned for a later day. */
  startLabel?: string;
  /** A big round gold play button (the Home card); the label stays as the accessible name. */
  round?: boolean;
}) {
  const [draftName, setDraftName] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setDraftName(loadLocalDraft(userId)?.name ?? null);
    refresh();
    window.addEventListener(DRAFT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DRAFT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  const resumeName = draftName ?? serverInProgress;
  if (round) {
    return (
      <Link
        href={resumeName ? "/train/workout" : startHref}
        aria-label={resumeName ? `Resume workout: ${resumeName}` : startLabel}
        className="btn-gold-round size-16 shrink-0 transition-transform hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data-testid={resumeName ? "resume-workout" : "start-workout"}
      >
        {resumeName ? <RotateCcw className="size-7" strokeWidth={2.5} aria-hidden /> : <Play className="ml-1 size-7 fill-current" aria-hidden />}
      </Link>
    );
  }
  if (resumeName) {
    return (
      <Button asChild className="w-full">
        <Link href="/train/workout" aria-label={`Resume workout: ${resumeName}`}>
          <RotateCcw aria-hidden /> Resume workout
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild className="w-full">
      <Link href={startHref}>
        <Play aria-hidden /> {startLabel}
      </Link>
    </Button>
  );
}
