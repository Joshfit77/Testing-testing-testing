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
}: {
  userId: string;
  startHref: string;
  serverInProgress: string | null;
  /** e.g. "Start workout early" when the next session is planned for a later day. */
  startLabel?: string;
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
