"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteWeeklyReportAction } from "@/server/actions/weekly-reports";

/**
 * Copy the shareable summary (headline numbers only: no foods, notes, journal or photos) and delete the report.
 * Nothing is shared unless the member taps Copy or Share themselves.
 */
export function ReportActions({ weekStart, summary }: { weekStart: string; summary: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: summary });
        return;
      }
      await navigator.clipboard.writeText(summary);
      setStatus("Summary copied.");
    } catch {
      setStatus("Couldn't share from this device. You can select the summary text and copy it.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Sharing sends only the summary below, nothing else from your report.</p>
      <pre className="whitespace-pre-wrap rounded-xl border border-border bg-elevated p-3 text-xs" data-testid="report-share-text">{summary}</pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={share} className="min-h-11">
          Share summary
        </Button>
        {confirming ? (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            className="min-h-11"
            onClick={() =>
              start(async () => {
                const r = await deleteWeeklyReportAction(weekStart);
                if (r.ok) router.push("/progress/reports");
                else setStatus(r.error);
              })
            }
          >
            {pending ? "Deleting…" : "Yes, delete this report"}
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirming(true)}>
            Delete report
          </Button>
        )}
      </div>
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  );
}
