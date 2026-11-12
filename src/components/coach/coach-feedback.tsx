"use client";

import { useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { submitCoachFeedbackAction } from "@/server/actions/coach-feedback";
import { cn } from "@/lib/utils";

type Rating = "yes" | "partially" | "no";
const OPTIONS: { value: Rating; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No" },
];

/**
 * TestFlight feedback under one coach reply: "Was this coaching advice useful?" (Yes / Partially / No), an optional
 * comment, and "Report a safety concern". Only rendered when the owner has switched feedback on (coach_feedback flag).
 */
export function CoachFeedback({ messageId }: { messageId: string }) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [mode, setMode] = useState<"ask" | "comment" | "safety" | "sent">("ask");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (input: { rating: Rating | null; safetyConcern: boolean; comment?: string }) =>
    start(async () => {
      setError(null);
      const res = await submitCoachFeedbackAction({ messageId, ...input });
      if (res.ok) setMode(input.comment !== undefined || input.safetyConcern ? "sent" : "comment");
      else setError(res.error);
    });

  if (mode === "sent") {
    return (
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        Thanks — your feedback was sent.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-2 text-xs" data-testid="coach-feedback">
      {mode === "safety" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            send({ rating, safetyConcern: true, comment });
          }}
        >
          <p className="font-medium text-foreground">Report a safety concern</p>
          <p className="text-muted-foreground">What in this reply worried you? If you&apos;re hurt or in danger, call your local emergency number now.</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} aria-label="What worried you (optional)" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="rounded-full bg-gold px-3 py-1.5 font-semibold text-black disabled:opacity-60">
              Send report
            </button>
            <button type="button" onClick={() => setMode(rating ? "comment" : "ask")} className="rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <span id={`fb-${messageId}`} className="mr-1 text-muted-foreground">
              Was this coaching advice useful?
            </span>
            <div role="group" aria-labelledby={`fb-${messageId}`} className="flex gap-1.5">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={rating === o.value}
                  disabled={pending}
                  onClick={() => {
                    setRating(o.value);
                    send({ rating: o.value, safetyConcern: false });
                  }}
                  className={cn("min-h-8 rounded-full border px-3 py-1", rating === o.value ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {mode === "comment" && (
            <form
              className="mt-2 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                send({ rating, safetyConcern: false, comment });
              }}
            >
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} placeholder="Anything to add? (optional)" aria-label="Comment (optional)" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <button type="submit" disabled={pending} className="rounded-full border border-border px-3 py-1 hover:border-gold-muted">
                Send comment
              </button>
            </form>
          )}
          <button type="button" onClick={() => setMode("safety")} className="mt-2 inline-flex min-h-8 items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            <ShieldAlert className="size-3.5" aria-hidden /> Report a safety concern
          </button>
        </>
      )}
      {error && (
        <p className="mt-1 text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
