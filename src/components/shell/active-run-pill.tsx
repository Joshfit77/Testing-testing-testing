"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Footprints } from "lucide-react";
import { formatDistance } from "@/lib/domain/activities";
import { keptSummary, LIVE_RUN_EVENT } from "@/lib/run/live-recording";

/**
 * Shown on every other screen while a run or walk keeps recording in the background of the app
 * (src/lib/run/live-recording.ts): what is recording, the distance so far, and the way back to it.
 */
export function ActiveRunPill() {
  const pathname = usePathname();
  const [summary, setSummary] = useState(keptSummary);

  useEffect(() => {
    const refresh = () => setSummary(keptSummary());
    refresh();
    window.addEventListener(LIVE_RUN_EVENT, refresh);
    return () => window.removeEventListener(LIVE_RUN_EVENT, refresh);
  }, [pathname]);

  if (!summary || pathname.startsWith("/run/record")) return null;
  const what = summary.kind === "walk" ? "walk" : summary.kind === "run" ? "run" : "activity";
  return (
    <Link
      href={summary.href || "/run/record"}
      data-hide-with-keyboard
      data-testid="active-run-pill"
      className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full border border-gold-muted bg-card px-4 py-2.5 text-sm font-semibold text-gold-highlight shadow-[0_10px_30px_-10px_rgba(201,165,76,0.6)]"
      aria-label={`Recording your ${what}: ${formatDistance(summary.distanceM, summary.unit)} so far. Back to the recording`}
    >
      <Footprints className="size-4 animate-pulse" aria-hidden />
      Recording {what}: <span className="tabular-nums text-foreground">{formatDistance(summary.distanceM, summary.unit)}</span>
      {summary.signalLost && <span className="text-xs font-normal text-muted-foreground">· no GPS</span>}
    </Link>
  );
}
