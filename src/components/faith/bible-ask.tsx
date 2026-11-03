"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { confirmDialog } from "@/components/ui/confirm";
import { chapterHref } from "@/lib/bible/books";
import { BIBLE_AI_MAX_QUESTION } from "@/lib/bible/ai";
import { parseReference } from "@/lib/bible/reference";
import { askBibleAction, clearBibleAiHistoryAction } from "@/server/actions/bible-ai";

export interface AskMessage {
  role: "user" | "assistant";
  content: string;
  citations?: { reference: string; text: string }[];
}

/** A conversation with the Bible study helper. Cited passages are shown from the verified BSB, not from the AI. */
export function BibleAsk({ initialThread, initialMessages, remaining }: { initialThread: string; initialMessages: AskMessage[]; remaining: number }) {
  const router = useRouter();
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [left, setLeft] = useState(remaining);
  const [pending, start] = useTransition();

  function ask() {
    const q = question.trim();
    if (q.length < 3) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion("");
    start(async () => {
      const r = await askBibleAction(q, thread).catch(() => ({ ok: false as const, code: "error" as const, error: "Couldn't reach the helper. Check your connection." }));
      if (!r.ok) {
        setMessages((m) => m.slice(0, -1));
        setQuestion(q);
        return toast.error(r.error);
      }
      setLeft((n) => Math.max(0, n - 1));
      setMessages((m) => [...m, { role: "assistant", content: r.answer, citations: r.citations }]);
    });
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 && (
        <ol className="space-y-3" aria-label="Conversation">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "ml-8 rounded-2xl bg-gold/10 p-3" : "mr-2 rounded-2xl border border-border bg-card p-3"}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">{m.role === "user" ? "You" : "Bible study helper (AI)"}</p>
              <p className="whitespace-pre-wrap text-[0.9375rem]">{m.content}</p>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Passages cited · BSB</p>
                  {m.citations.map((c) => {
                    const r = parseReference(c.reference);
                    return (
                      <div key={c.reference}>
                        {r ? (
                          <Link href={chapterHref(r.bookId, r.chapter, r.verseStart)} className="text-sm font-semibold text-gold-highlight hover:underline">
                            {c.reference}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold">{c.reference}</span>
                        )}
                        <p className="line-clamp-4 font-serif text-sm text-muted-foreground">{c.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
          {pending && (
            <li className="mr-2 flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-gold" aria-hidden /> Reading the passages…
            </li>
          )}
        </ol>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="space-y-2"
      >
        <label htmlFor="bible-question" className="sr-only">
          Your question
        </label>
        <Textarea id="bible-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={BIBLE_AI_MAX_QUESTION} placeholder="e.g. What does Romans 8:28 mean? What does the Bible say about worry?" className="min-h-20" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{left} question{left === 1 ? "" : "s"} left today</span>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setThread(crypto.randomUUID());
                  setMessages([]);
                }}
              >
                <Plus aria-hidden /> New conversation
              </Button>
            )}
            <Button type="submit" size="sm" disabled={pending || question.trim().length < 3 || left === 0}>
              <Send aria-hidden /> Ask
            </Button>
          </div>
        </div>
      </form>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={async () => {
          if (!(await confirmDialog({ title: "Delete your Bible helper history?", message: "All your questions and answers here will be deleted.", confirmLabel: "Delete", destructive: true }))) return;
          await clearBibleAiHistoryAction();
          setMessages([]);
          setThread(crypto.randomUUID());
          router.refresh();
        }}
      >
        <Trash2 aria-hidden /> Delete history
      </Button>
    </div>
  );
}
