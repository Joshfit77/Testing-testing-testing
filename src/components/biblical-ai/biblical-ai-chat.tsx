"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RotateCcw, Send, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { AnswerView, type ShownPassage } from "@/components/biblical-ai/answer-view";
import { DEPTHS, MAX_QUESTION, type CategoryId, type Depth } from "@/lib/biblical-ai/config";
import type { ValidatedAnswer } from "@/lib/biblical-ai/answer";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  answer?: ValidatedAnswer | null;
  passages?: ShownPassage[];
  /** A saved copy of this answer exists. */
  saved?: boolean;
}

const STATUS_TEXT: Record<string, string> = {
  sending: "Sending your question…",
  retrieving: "Finding passages in the Berean Standard Bible…",
  answering: "Studying the passages…",
  checking: "Checking every reference and quotation against the BSB…",
  saving: "Saving your study…",
};

type Pending = { question: string; requestId: string; status: string };
type Failed = { question: string; requestId: string; error: string; retryable: boolean };

/**
 * One Biblical AI conversation. A question is sent once per request id: Retry re-sends the same id, so a question
 * that was in fact answered is returned from the server instead of being asked (and counted) twice. Cancel stops the
 * request; nothing is counted.
 */
export function BiblicalAiChat(props: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  category: CategoryId;
  depth: Depth;
  allowedDepths: Depth[];
  initialQuestion?: string;
  passage?: string | null;
  shared?: { label: string; text: string } | null;
  remainingToday: number;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(props.conversationId);
  const [messages, setMessages] = useState(props.initialMessages);
  const [question, setQuestion] = useState(props.initialQuestion ?? "");
  const [depth, setDepth] = useState<Depth>(props.allowedDepths.includes(props.depth) ? props.depth : "standard");
  const [shared, setShared] = useState(props.shared ?? null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [left, setLeft] = useState(props.remainingToday);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const lastAnswer = useRef<HTMLLIElement | null>(null);
  /** One short line for screen readers (the conversation itself isn't read out in full). */
  const [announce, setAnnounce] = useState("");
  /** A cancelled question, kept so sending it again unchanged reuses its id (never counted twice). */
  const cancelled = useRef<{ question: string; requestId: string } | null>(null);
  /** Why the request was stopped: the member's Cancel, or the screen's own timer. */
  const stopReason = useRef<"cancel" | "timeout" | null>(null);
  const back = conversationId ? `/faith/biblical-ai/ask?c=${conversationId}` : "/faith/biblical-ai";

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, pending?.status]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(q: string, requestId: string) {
    if (pending) return;
    setFailed(null);
    setPending({ question: q, requestId, status: "sending" });
    setAnnounce("Studying your question…");
    const ctrl = new AbortController();
    abort.current = ctrl;
    stopReason.current = null;
    // Longer than the server's own limit (140 s), so the server normally answers first with a clear reason.
    const timer = setTimeout(() => {
      stopReason.current = "timeout";
      ctrl.abort();
    }, 170_000);
    try {
      const res = await fetch("/api/biblical-ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ question: q, depth, category: props.category, requestId, conversationId, passage: props.passage ?? null, memberShared: shared?.text ?? null }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        const msg = res.status === 401 ? "Please sign in again." : (body?.message ?? (typeof body?.error === "string" && body.error.length > 20 ? body.error : "Biblical AI couldn't answer just now."));
        setFailed({ question: q, requestId, error: msg, retryable: res.status >= 500 || res.status === 429 });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev:
            | { type: "ping" }
            | { type: "status"; status: string }
            | { type: "done"; result: { conversationId: string; messageId: string; answer: ValidatedAnswer; passages: ShownPassage[]; replayed: boolean } }
            | { type: "error"; code: string; error: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "ping") continue;
          const unused = null as unknown as
            | { type: "status"; status: string }
            | { type: "done"; result: { conversationId: string; messageId: string; answer: ValidatedAnswer; passages: ShownPassage[]; replayed: boolean } }
            | { type: "error"; code: string; error: string };
          void unused;
          if (ev.type === "status") setPending((p) => (p ? { ...p, status: ev.status } : p));
          else if (ev.type === "done") {
            finished = true;
            const r = ev.result;
            setMessages((m) => [...m, { id: `${r.messageId}-q`, role: "user", content: q }, { id: r.messageId, role: "assistant", content: r.answer.answer, answer: r.answer, passages: r.passages }]);
            if (!r.replayed) setLeft((n) => Math.max(0, n - 1));
            setShared(null);
            cancelled.current = null;
            setAnnounce("Answer ready.");
            requestAnimationFrame(() => lastAnswer.current?.focus());
            if (!conversationId) {
              setConversationId(r.conversationId);
              window.history.replaceState(null, "", `/faith/biblical-ai/ask?c=${r.conversationId}`);
            }
          } else {
            finished = true;
            if (ev.code === "consent_required" || ev.code === "unavailable") router.refresh();
            setFailed({ question: q, requestId, error: ev.error, retryable: ev.code === "error" || ev.code === "rate_limited" || ev.code === "timeout" });
            setAnnounce(ev.error);
          }
        }
      }
      if (!finished) setFailed({ question: q, requestId, error: "The connection was interrupted.", retryable: true });
    } catch (err) {
      if (ctrl.signal.aborted && stopReason.current === "timeout") {
        setFailed({ question: q, requestId, error: "That took too long. Please try again; you won't be counted twice.", retryable: true });
      } else if (ctrl.signal.aborted) {
        setQuestion(q);
        cancelled.current = { question: q, requestId };
        toast.info("Cancelled.");
        setAnnounce("Cancelled.");
        requestAnimationFrame(() => input.current?.focus());
      } else {
        setFailed({ question: q, requestId, error: err instanceof Error && /fetch|network/i.test(err.message) ? "Couldn't reach Biblical AI. Check your connection." : "Something went wrong.", retryable: true });
      }
    } finally {
      clearTimeout(timer);
      abort.current = null;
      setPending(null);
    }
  }

  function submit() {
    const q = question.trim();
    if (q.length < 3 || pending) return;
    setQuestion("");
    // Sending a cancelled question again unchanged reuses its id: if the server had already saved it, that answer
    // comes back instead of a second, counted one.
    const reuse = cancelled.current?.question === q ? cancelled.current.requestId : null;
    cancelled.current = null;
    void send(q, reuse ?? crypto.randomUUID());
  }

  /** A fresh study on this screen (the page itself isn't reloaded, so its state is reset here). */
  function newStudy() {
    abort.current?.abort();
    setMessages([]);
    setConversationId(null);
    setFailed(null);
    setQuestion("");
    cancelled.current = null;
    window.history.replaceState(null, "", "/faith/biblical-ai/ask");
    requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 && (
        <ol className="space-y-4 [overflow-wrap:anywhere]" aria-label="Conversation">
          {messages.map((m, i) => (
            <li
              key={m.id}
              ref={i === messages.length - 1 && m.role === "assistant" ? lastAnswer : undefined}
              tabIndex={i === messages.length - 1 && m.role === "assistant" ? -1 : undefined}
              className={m.role === "user" ? "ml-8 rounded-2xl bg-gold/10 p-3" : "rounded-2xl border border-border bg-card p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-highlight"}
            >
              <p className="mb-1 text-xs font-semibold text-muted-foreground">{m.role === "user" ? "You" : "Narrow Gate Biblical AI"}</p>
              {m.role === "assistant" && m.answer ? (
                <AnswerView answer={m.answer} passages={m.passages ?? []} back={back} messageId={m.id} question={messages[i - 1]?.content} saved={m.saved} />
              ) : (
                <p className="whitespace-pre-wrap text-body">{m.content}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="sr-only" role="status" aria-live="polite" data-testid="biblical-ai-announce">
        {announce}
      </p>
      {pending && (
        <div className="space-y-2">
          <p className="ml-8 rounded-2xl bg-gold/10 p-3 text-body">{pending.question}</p>
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3" data-testid="biblical-ai-status">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-gold" aria-hidden /> {STATUS_TEXT[pending.status] ?? STATUS_TEXT.answering}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                stopReason.current = "cancel";
                abort.current?.abort();
              }}
            >
              <Square aria-hidden /> Cancel
            </Button>
          </div>
        </div>
      )}

      {failed && (
        <div role="alert" className="space-y-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-3 text-sm" data-testid="biblical-ai-error">
          <p>{failed.error}</p>
          <div className="flex flex-wrap gap-2">
            {failed.retryable && (
              <Button type="button" size="sm" variant="secondary" onClick={() => void send(failed.question, failed.requestId)}>
                <RotateCcw aria-hidden /> Try again
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuestion(failed.question);
                setFailed(null);
              }}
            >
              Edit the question
            </Button>
          </div>
        </div>
      )}
      <div ref={bottom} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-2 rounded-2xl border border-gold-muted/60 bg-card p-3"
        data-testid="biblical-ai-form"
      >
        {shared && (
          <div className="space-y-1 rounded-xl border border-border bg-background/50 p-2 text-sm" data-testid="biblical-ai-shared">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Shared with this question: {shared.label}</p>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Don't share this" onClick={() => setShared(null)}>
                <X aria-hidden />
              </Button>
            </div>
            <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{shared.text}</p>
            <p className="text-xs text-muted-foreground">This text is sent to our AI provider with your question only because you chose to share it. Remove it to ask without it.</p>
          </div>
        )}
        <label htmlFor="biblical-ai-question" className="sr-only">
          Your question
        </label>
        <Textarea
          ref={input}
          id="biblical-ai-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION}
          placeholder={props.passage ? `Ask about ${props.passage}…` : "Ask a biblical question, e.g. What does Romans 8:28 mean?"}
          className="min-h-24"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <fieldset className="flex flex-wrap gap-1" aria-label="Study depth">
          <legend className="sr-only">Study depth</legend>
          {DEPTHS.map((d) => {
            const allowed = props.allowedDepths.includes(d.id);
            return (
              <label key={d.id} className={cn("inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-xs font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-highlight", depth === d.id ? "border-gold bg-gold/15 text-gold-highlight" : "border-border text-muted-foreground", !allowed && "cursor-not-allowed opacity-50")} title={allowed ? d.description : "Included with Pro All Access"}>
                <input type="radio" name="depth" value={d.id} checked={depth === d.id} disabled={!allowed} onChange={() => setDepth(d.id)} className="sr-only" />
                {d.label}
                {!allowed && " · Pro"}
              </label>
            );
          })}
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground" data-testid="biblical-ai-remaining">
            {left > 0 ? (
              `${left} question${left === 1 ? "" : "s"} left today`
            ) : (
              <>
                No questions left today; they come back over the next 24 hours.{" "}
                {!props.allowedDepths.includes("deep") && (
                  <a href="/profile/billing" className="font-semibold text-gold-highlight underline-offset-4 hover:underline">
                    Pro All Access
                  </a>
                )}{" "}
                includes more. The Bible is always free to read.
              </>
            )}
          </span>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={newStudy}>
                <Plus aria-hidden /> New study
              </Button>
            )}
            <Button type="submit" size="sm" disabled={Boolean(pending) || question.trim().length < 3 || left === 0}>
              <Send aria-hidden /> Ask
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
