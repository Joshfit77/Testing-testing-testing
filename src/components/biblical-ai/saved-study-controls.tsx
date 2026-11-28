"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { confirmDialog } from "@/components/ui/confirm";
import { deleteSavedStudyAction, updateSavedStudyAction } from "@/server/actions/biblical-ai";

/** The member's note, bookmark and delete for a saved study. The note stays private (it is never sent to the AI). */
export function SavedStudyControls({ id, note: initialNote, bookmarked: initialBookmarked, afterDelete = "/faith/biblical-ai/saved" }: { id: string; note: string; bookmarked: boolean; afterDelete?: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, start] = useTransition();
  return (
    <section aria-label="Your notes" className="space-y-2 rounded-2xl border border-border bg-card p-3">
      <label htmlFor="study-note" className="text-sm font-semibold">
        Your reflection notes <span className="font-normal text-muted-foreground">(private, never sent to the AI)</span>
      </label>
      <Textarea id="study-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} className="min-h-24" />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateSavedStudyAction(id, { note });
              if (!r.ok) return toast.error(r.error);
              toast.success("Note saved");
            })
          }
        >
          Save note
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-pressed={bookmarked}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateSavedStudyAction(id, { bookmarked: !bookmarked });
              if (!r.ok) return toast.error(r.error);
              setBookmarked(!bookmarked);
            })
          }
        >
          <Bookmark className={bookmarked ? "fill-gold text-gold" : ""} aria-hidden /> {bookmarked ? "Bookmarked" : "Bookmark"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={async () => {
            if (!(await confirmDialog({ title: "Delete this saved study?", message: "It will be removed from your studies.", confirmLabel: "Delete", destructive: true }))) return;
            start(async () => {
              const r = await deleteSavedStudyAction(id);
              if (!r.ok) return toast.error(r.error);
              router.push(afterDelete);
            });
          }}
        >
          <Trash2 aria-hidden /> Delete
        </Button>
      </div>
    </section>
  );
}
