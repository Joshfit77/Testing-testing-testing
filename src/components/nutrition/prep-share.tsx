"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Share or copy the prep plan as plain text (the share sheet where the device has one). Nothing is sent unless tapped. */
export function PrepShare({ text }: { text: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Prep plan copied.");
    } catch {
      setStatus("Couldn't share from this device. You can select the text below and copy it.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={share}>
          Share prep plan
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-elevated p-3 text-xs" data-testid="prep-share-text">
        {text}
      </pre>
    </div>
  );
}
