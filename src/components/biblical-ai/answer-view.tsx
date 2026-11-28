"use client";

import { useSafeTransition } from "@/lib/use-safe-transition";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Bookmark, Check, Copy, ExternalLink, Flag, Languages, Save, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScriptureText } from "@/components/bible/scripture-text";
import { EVIDENCE_LABEL, type ValidatedAnswer } from "@/lib/biblical-ai/answer";
import { linkReferences, referenceHref } from "@/lib/biblical-ai/links";
import { parseReference } from "@/lib/bible/reference";
import { bookById } from "@/lib/bible/books";
import type { TextPart } from "@/lib/bible/red-letter";
import { reportAnswerAction, saveAnswerAction } from "@/server/actions/biblical-ai";
import { cn } from "@/lib/utils";

export interface ShownPassage {
  reference: string;
  text: string;
  parts?: TextPart[];
  truncated: boolean;
}

/** Prose with every verified Scripture reference as a link to the reader (peek mode, with the way back). */
export function LinkedText({ text, back, className }: { text: string; back: string; className?: string }) {
  return (
    <p className={cn("whitespace-pre-wrap text-body leading-relaxed", className)}>
      {linkReferences(text, () => true, back).map((s, i) =>
        "href" in s ? (
          <Link key={i} href={s.href} className="font-semibold text-gold-highlight underline-offset-4 hover:underline">
            {s.text}
          </Link>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}

function Section({ title, children, open = false, testId }: { title: string; children: React.ReactNode; open?: boolean; testId?: string }) {
  return (
    <details className="group rounded-xl border border-border bg-background/40" open={open} data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-gold transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}

/** Only https links from approved source documents are ever shown. */
function safeExternal(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function AnswerView({ answer, passages, back, messageId, question, saved: initiallySaved = false }: { answer: ValidatedAnswer; passages: ShownPassage[]; back: string; messageId?: string; question?: string; saved?: boolean }) {
  // From the server (whether a saved copy exists), so it stays right after a refresh or a reload.
  const [saved, setSaved] = useState(initiallySaved);
  const [report, setReport] = useState(false);
  const [pending, start] = useSafeTransition();
  const byRef = new Map(passages.map((p) => [p.reference, p]));

  function plainText(): string {
    const scripture = answer.scripture.map((s) => `${s.reference} (BSB): ${byRef.get(s.reference)?.text ?? ""}`).join("\n");
    return [question ? `Q: ${question}` : "", answer.answer, scripture, answer.application ? `Application: ${answer.application}` : "", "— Narrow Gate Biblical AI (an AI study companion; read every passage for yourself). Scripture: Berean Standard Bible, public domain."]
      .filter(Boolean)
      .join("\n\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText());
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  }

  async function share() {
    const text = plainText();
    if (navigator.share) {
      try {
        await navigator.share({ title: answer.title, text });
        return;
      } catch {
        // Cancelled or unavailable: fall back to copying.
      }
    }
    await copy();
  }

  return (
    <article className="space-y-3" aria-label={answer.title} data-testid="biblical-ai-answer">
      {answer.safety && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm" data-testid="biblical-ai-safety">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>{answer.safety}</span>
        </p>
      )}
      <LinkedText text={answer.answer} back={back} />

      {answer.scripture.length > 0 && (
        <section aria-label="Scripture" className="space-y-2 rounded-xl border border-gold-muted/50 bg-gold/5 p-3" data-testid="biblical-ai-scripture">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Scripture · Berean Standard Bible</p>
          {answer.scripture.map((s) => {
            const p = byRef.get(s.reference);
            const href = referenceHref(s.reference, back);
            return (
              <div key={s.reference} className="space-y-1">
                {href ? (
                  <Link href={href} className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-gold-highlight hover:underline">
                    <BookOpen className="size-3.5" aria-hidden /> {s.reference}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold">{s.reference}</span>
                )}
                {p && (
                  <blockquote className="font-serif text-[0.95rem] leading-relaxed text-foreground/90">
                    <ScriptureText text={p.text} parts={p.parts} />
                    {p.truncated && <span className="block pt-1 font-sans text-xs text-muted-foreground">The first verses are shown. Open the passage to read all of it.</span>}
                  </blockquote>
                )}
                {s.note && <p className="text-sm text-muted-foreground">{s.note}</p>}
              </div>
            );
          })}
        </section>
      )}

      {answer.context && (
        <Section title="Literary and historical context" testId="section-context">
          <LinkedText text={answer.context} back={back} className="text-sm" />
        </Section>
      )}
      {answer.originalLanguage.length > 0 && (
        <Section title="Original language" testId="section-languages">
          {answer.originalLanguage.map((o) => {
            const ref = parseReference(o.reference);
            const book = ref && bookById(ref.bookId);
            const words = book && ref.verseStart ? `/faith/bible/words/${book.slug}/${ref.chapter}/${ref.verseStart}?back=${encodeURIComponent(back)}` : null;
            return (
              <div key={`${o.reference}-${o.strong}`} className="space-y-1 border-b border-border/60 pb-2 last:border-0">
                <p className="text-sm font-semibold">
                  {o.word && (
                    <span lang={o.strong.startsWith("H") ? "he" : "grc"} dir={o.strong.startsWith("H") ? "rtl" : "ltr"} className="mr-1 font-serif text-base">
                      {o.word}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {o.strong} · {o.reference}
                  </span>
                </p>
                <LinkedText text={o.explanation} back={back} className="text-sm" />
                {words && (
                  <Link href={words} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-gold-highlight hover:underline">
                    <Languages className="size-3.5" aria-hidden /> See every word of {o.reference}
                  </Link>
                )}
              </div>
            );
          })}
        </Section>
      )}
      {answer.history.length > 0 && (
        <Section title="History and archaeology" testId="section-history">
          <ul className="space-y-2">
            {answer.history.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="mr-2 inline-block rounded-full border border-gold-muted px-2 py-0.5 text-xs font-semibold text-gold-highlight">{EVIDENCE_LABEL[h.evidence]}</span>
                <LinkedText text={h.claim} back={back} className="inline text-sm" />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {answer.commentary.length > 0 && (
        <Section title="Verified commentary" testId="section-commentary">
          {answer.commentary.map((c) => {
            const url = safeExternal(c.url);
            return (
              <div key={c.documentId} className="space-y-1 text-sm">
                <p className="font-semibold">
                  {c.author}, <span className="italic">{c.title}</span>
                  {c.publishedOn ? ` (${c.publishedOn.slice(0, 4)})` : ""}
                </p>
                <p className="text-muted-foreground">{c.summary}</p>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-gold-highlight hover:underline">
                    Read the original <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">A summary of the source, not the teacher&apos;s own words. No teacher or ministry endorses or is affiliated with this app.</p>
        </Section>
      )}
      {answer.application && (
        <Section title="Practical application" open testId="section-application">
          <LinkedText text={answer.application} back={back} className="text-sm" />
        </Section>
      )}
      {answer.reflectionQuestions.length > 0 && (
        <Section title="Reflection questions" testId="section-reflection">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {answer.reflectionQuestions.map((q, i) => (
              <li key={i}>
                <LinkedText text={q} back={back} className="text-sm" />
              </li>
            ))}
          </ol>
        </Section>
      )}
      {answer.uncertainty && (
        <Section title="Where Christians differ, or the evidence is limited" testId="section-uncertainty">
          <LinkedText text={answer.uncertainty} back={back} className="text-sm" />
        </Section>
      )}
      {answer.furtherStudy.length > 0 && (
        <Section title="Further study" testId="section-further">
          <ul className="space-y-1 text-sm">
            {answer.furtherStudy.map((f) => {
              const href = referenceHref(f, back);
              return <li key={f}>{href ? <Link href={href} className="font-semibold text-gold-highlight hover:underline">{f}</Link> : f}</li>;
            })}
          </ul>
        </Section>
      )}
      {answer.limitations.length > 0 && (
        <p className="rounded-lg border border-border bg-elevated/60 p-2 text-xs text-muted-foreground" data-testid="biblical-ai-limitations">
          Checked against the Berean Standard Bible: {answer.limitations.join(" ")}
        </p>
      )}

      {messageId && (
        <div className="flex flex-wrap gap-1 border-t border-border pt-2" role="group" aria-label="Answer actions">
          <Button type="button" variant="ghost" size="sm" onClick={() => void copy()}>
            <Copy aria-hidden /> Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || saved}
            onClick={() =>
              start(async () => {
                const r = await saveAnswerAction(messageId);
                if (!r.ok) return toast.error(r.error);
                setSaved(true);
                toast.success("Saved to your studies");
              })
            }
          >
            {saved ? <Check aria-hidden /> : <Save aria-hidden />} {saved ? "Saved" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAnswerAction(messageId, true);
                if (!r.ok) return toast.error(r.error);
                setSaved(true);
                toast.success("Bookmarked");
              })
            }
          >
            <Bookmark aria-hidden /> Bookmark
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void share()}>
            <Share2 aria-hidden /> Share
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setReport(true)}>
            <Flag aria-hidden /> Report
          </Button>
        </div>
      )}
      {messageId && <ReportDialog open={report} onClose={() => setReport(false)} messageId={messageId} />}
    </article>
  );
}

function ReportDialog({ open, onClose, messageId }: { open: boolean; onClose: () => void; messageId: string }) {
  const [kind, setKind] = useState<"inaccurate" | "helpful" | "unhelpful">("inaccurate");
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="bottom">
        <DialogTitle>Report this answer</DialogTitle>
        <DialogDescription>
          {kind === "inaccurate"
            ? "Your question and this answer will be sent to the Narrow Gate team so they can check it. Nothing else from your account is included."
            : "Only your rating (and a note, if you add one) is sent."}
        </DialogDescription>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">What&apos;s wrong?</legend>
          {(
            [
              ["inaccurate", "Inaccurate or unbiblical"],
              ["unhelpful", "Not helpful"],
              ["helpful", "Helpful"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="report-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-4 accent-[var(--color-gold)]" />
              {label}
            </label>
          ))}
        </fieldset>
        <label htmlFor="report-note" className="mt-2 block text-sm font-semibold">
          What should we know? (optional)
        </label>
        <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="min-h-20" />
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await reportAnswerAction(messageId, kind, note.trim() || null);
                if (!r.ok) return toast.error(r.error);
                toast.success("Thank you. Your report was sent.");
                setNote("");
                onClose();
              })
            }
          >
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
