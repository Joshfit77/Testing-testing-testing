"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { saveStudyNotesAction } from "@/server/actions/studies";

export function StudyNotesForm({ study, lesson, initial }: { study: string; lesson: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveStudyNotesAction(study, lesson, value);
          if (r.ok) toast.success("Notes saved. Only you can see them.");
          else toast.error(r.error ?? "Couldn't save.");
        });
      }}
      className="space-y-2"
    >
      <label htmlFor="study-notes" className="text-sm font-semibold">
        Your notes
      </label>
      <Textarea id="study-notes" value={value} onChange={(e) => setValue(e.target.value)} maxLength={10000} className="min-h-28" placeholder="What stood out to you? What will you do?" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Private to you
        </span>
        <Button type="submit" size="sm" disabled={pending}>
          Save notes
        </Button>
      </div>
    </form>
  );
}
